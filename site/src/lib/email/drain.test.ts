import { describe, expect, it } from "vitest";
import type { EmailEnv } from "@/lib/env";
import { drainEmails, handleDrainRequest, type DrainDeps, type QueuedEmail } from "./drain";
import { renderEmail } from "./render";
import type { OutgoingEmail } from "./send";

const REQUEST_ID = "00000000-0000-4000-8000-0000000000c1";
const USER_ID = "00000000-0000-4000-8000-0000000000a2";
const MESSAGE_ID = "00000000-0000-4000-8000-0000000000d1";

const PRODUCTION: EmailEnv = {
  appEnv: "production",
  sending: { apiKey: "re_test", from: "Example Youth <hello@mail.example.test>" },
  ownerAlertEmail: "owner@example.test",
  webhookSecret: null,
  drainSecret: "test-drain-secret",
};

function queued(id: string, overrides: Partial<QueuedEmail> = {}): QueuedEmail {
  return {
    id: `00000000-0000-4000-8000-00000000e${id}`,
    template: "request-submitted",
    to_address: "owner@example.test",
    subject: "R-0042 is ready for review",
    related_type: "reimbursement_request",
    related_id: REQUEST_ID,
    resend_id: null,
    created_at: "2026-10-02T22:14:00Z",
    ...overrides,
  };
}

const SUBMITTED = {
  number: "R-0042",
  amount_cents: 4550,
  vendor: "Fake Store",
  by: "Test Requester",
  payee: "Test Requester",
  by_payee: true,
  description: "Snacks for game night",
  note: null,
  payment_method: null,
  paid_at: null,
};

/**
 * An outbox that hands each email out once, like email_claim(), plus fakes
 * for Resend and the log that record every call. Rendering is real.
 */
function fakes(rows: QueuedEmail[], details: Record<string, unknown>, overrides: Partial<DrainDeps> = {}) {
  const outbox = [...rows];
  const claims: { env: string; limit: number }[] = [];
  const sent: OutgoingEmail[] = [];
  const marked: Parameters<DrainDeps["mark"]>[0][] = [];
  const pauses: number[] = [];
  const reports: { source: string; message: string }[] = [];
  const deps: DrainDeps = {
    env: PRODUCTION,
    links: { financesUrl: "https://finances.example.test", portalUrl: "https://portal.example.test" },
    claim: async (env, limit) => {
      claims.push({ env, limit });
      return outbox.splice(0, limit);
    },
    details: async (id) => details[id] ?? null,
    send: async (email) => {
      sent.push(email);
      return { id: `re_${sent.length}` };
    },
    mark: async (input) => {
      marked.push(input);
    },
    render: renderEmail,
    pause: async (ms) => {
      pauses.push(ms);
    },
    now: () => 0,
    queueDigest: async () => 0,
    digestTo: () => "youth@example.test",
    report: (source, error) => {
      reports.push({ source, message: error instanceof Error ? error.message : String(error) });
    },
    ...overrides,
  };
  return { deps, claims, sent, marked, pauses, outbox, reports };
}

describe("drainEmails", () => {
  it("sends each queued email once, with its log ID as the idempotency key, and marks it sent", async () => {
    const email = queued("001");
    const { deps, claims, sent, marked } = fakes([email], { [email.id]: SUBMITTED });

    const result = await drainEmails(deps);

    expect(result).toEqual({ status: "drained", sent: 1, failed: 0 });
    expect(claims[0]).toEqual({ env: "production", limit: 5 });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      from: "Example Youth <hello@mail.example.test>",
      to: "owner@example.test",
      subject: "R-0042 is ready for review",
      idempotencyKey: email.id,
      tags: [
        { name: "log_id", value: email.id },
        { name: "template", value: "request-submitted" },
      ],
    });
    expect(marked).toEqual([{ id: email.id, status: "sent", resendId: "re_1" }]);
  });

  it("tells owners who sent what, and links to the request in finances", async () => {
    const email = queued("001");
    const { deps, sent } = fakes([email], { [email.id]: SUBMITTED });

    await drainEmails(deps);

    expect(sent[0].text).toContain("R-0042 is ready for review");
    expect(sent[0].text).toContain("Test Requester asked to be paid back $45.50.");
    expect(sent[0].text).toContain("Fake Store");
    expect(sent[0].text).toContain("Snacks for game night");
    expect(sent[0].html).toContain(`href="https://finances.example.test/admin/requests/${REQUEST_ID}"`);
    expect(sent[0].text).toContain("because you're an owner");
  });

  it("names the payee when someone else sent the request", async () => {
    const email = queued("001");
    const { deps, sent } = fakes([email], { [email.id]: { ...SUBMITTED, by: "Test Owner", by_payee: false } });

    await drainEmails(deps);

    expect(sent[0].text).toContain("Test Owner sent a $45.50 request for Test Requester.");
  });

  it("goes by the sender's name when they asked for their own money under another payee name", async () => {
    const email = queued("001");
    const { deps, sent } = fakes([email], { [email.id]: { ...SUBMITTED, by: "Test Requester", payee: "Tess" } });

    await drainEmails(deps);

    expect(sent[0].text).toContain("Test Requester asked to be paid back $45.50.");
  });

  it("lines up the request's facts in plain text", async () => {
    const email = queued("001");
    const { deps, sent } = fakes([email], { [email.id]: SUBMITTED });

    await drainEmails(deps);

    expect(sent[0].text).toMatch(/^Amount +\$45\.50$/m);
    expect(sent[0].text).toMatch(/^Store +Fake Store$/m);
    expect(sent[0].text).toMatch(/^What for +Snacks for game night$/m);
  });

  it("gives the requester the owner's question and links to their own request", async () => {
    const email = queued("001", {
      template: "request-returned",
      to_address: "requester@example.test",
      subject: "Your request R-0042 needs more info",
    });
    const { deps, sent } = fakes([email], {
      [email.id]: { ...SUBMITTED, by: "Test Owner", payee: null, description: null, note: "Which event was it?" },
    });

    await drainEmails(deps);

    expect(sent[0].to).toBe("requester@example.test");
    expect(sent[0].text).toContain("Test Owner has a question about your $45.50 request from Fake Store:");
    expect(sent[0].text).toContain("Which event was it?");
    expect(sent[0].text).toContain("Resubmit");
    expect(sent[0].html).toContain(`href="https://finances.example.test/my/${REQUEST_ID}"`);
  });

  it("tells the requester how and when they were paid", async () => {
    const email = queued("001", {
      template: "request-paid",
      to_address: "requester@example.test",
      subject: "Your request R-0042 was paid",
    });
    const { deps, sent } = fakes([email], {
      [email.id]: {
        ...SUBMITTED,
        by: "Test Owner",
        payee: null,
        description: null,
        payment_method: "cash_app",
        // 5 PM in Los Angeles on Sep 30, already Oct 1 in UTC.
        paid_at: "2026-10-01T00:00:00+00:00",
      },
    });

    await drainEmails(deps);

    expect(sent[0].text).toContain("Your $45.50 request from Fake Store was paid through Cash App on Sep 30, 2026.");
    expect(sent[0].html).toContain(`href="https://finances.example.test/my/${REQUEST_ID}"`);
  });

  it("leaves out the payment method when it was paid another way", async () => {
    const email = queued("001", { template: "request-paid", subject: "Your request R-0042 was paid" });
    const { deps, sent } = fakes([email], {
      [email.id]: { ...SUBMITTED, payment_method: "other", paid_at: "2026-09-30T19:00:00+00:00" },
    });

    await drainEmails(deps);

    expect(sent[0].text).toContain("Your $45.50 request from Fake Store was paid on Sep 30, 2026.");
  });

  it("tells every owner who changed Owner and when, and links to People", async () => {
    const email = queued("001", {
      template: "owner-changed",
      subject: "Second Person is now an owner",
      related_type: "user",
      related_id: USER_ID,
    });
    const { deps, sent } = fakes([email], { [email.id]: { name: "Second Person", by: "Test Owner" } });

    await drainEmails(deps);

    expect(sent[0].text).toContain("Second Person is now an owner");
    expect(sent[0].text).toContain("Test Owner made this change on Oct 2, 2026 at 3:14 PM.");
    expect(sent[0].html).toContain('href="https://portal.example.test/people"');
  });

  it("still sends an owner alert when nobody signed in made the change", async () => {
    const email = queued("001", {
      template: "owner-changed",
      subject: "Second Person is no longer an owner",
      related_type: "user",
      related_id: USER_ID,
    });
    const { deps, sent } = fakes([email], { [email.id]: { name: "Second Person", by: null } });

    await drainEmails(deps);

    expect(sent[0].text).toContain("This change was made on Oct 2, 2026 at 3:14 PM, outside the portal.");
  });

  it("warns owners about the month with the count in its subject, and links to Email", async () => {
    const email = queued("001", {
      template: "quota-warning",
      subject: "2,400 of 3,000 emails used this month",
      related_type: null,
      related_id: null,
    });
    const { deps, sent } = fakes([email], {});

    await drainEmails(deps);

    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe("2,400 of 3,000 emails used this month");
    expect(sent[0].text).toContain("2,400 of 3,000 emails used this month");
    expect(sent[0].text).toContain("only sign-in codes");
    expect(sent[0].html).toContain('href="https://portal.example.test/email"');
  });

  describe("form alerts", () => {
    const alert = (subject: string) =>
      queued("001", {
        template: "form-alert",
        to_address: "youth@example.test",
        subject,
        related_type: "message",
        related_id: MESSAGE_ID,
      });
    const CONTACT = {
      kind: "contact",
      name: "Maya Example",
      email: "maya@example.test",
      phone: "555-555-0123",
      message: "Is there youth this Friday?\nAnd what time?",
      details: { role: "parent" },
      env: "production",
    };

    it("shows the whole message, links to it in the portal, and replies to the sender", async () => {
      const email = alert("Maya sent a message");
      const { deps, sent } = fakes([email], { [email.id]: CONTACT });

      await drainEmails(deps);

      expect(sent[0]).toMatchObject({
        to: "youth@example.test",
        subject: "Maya sent a message",
        replyTo: "maya@example.test",
      });
      for (const line of [
        "Maya Example sent a message from the Contact page.",
        "maya@example.test",
        "555-555-0123",
        "Parent or guardian",
        "Is there youth this Friday?",
        "And what time?",
        "Oct 2, 2026 at 3:14 PM",
        "Reply to this email to write back to Maya.",
      ]) {
        expect(sent[0].text).toContain(line);
      }
      expect(sent[0].html).toContain(`href="https://portal.example.test/messages/${MESSAGE_ID}"`);
    });

    it("says a takedown request is about a photo", async () => {
      const email = alert("Pat asked to take down a photo");
      const takedown = { ...CONTACT, kind: "takedown", name: "Pat Example", email: "pat@example.test" };
      const { deps, sent } = fakes([email], { [email.id]: takedown });

      await drainEmails(deps);

      expect(sent[0].text).toContain("Pat Example asked us to take down a photo.");
      expect(sent[0].replyTo).toBe("pat@example.test");
    });

    it("names the areas someone wants to serve in", async () => {
      const email = alert("Sam wants to serve");
      const serve = {
        kind: "serve",
        name: "Sam Example",
        email: null,
        phone: "555-555-0199",
        message: null,
        details: { areas: ["worship", "media"] },
        env: "production",
      };
      const { deps, sent } = fakes([email], { [email.id]: serve });

      await drainEmails(deps);

      expect(sent[0].text).toContain("Sam Example wants to serve.");
      expect(sent[0].text).toContain("Worship, Media");
      expect(sent[0].text).toContain("Sam left a phone number, so call or text to write back.");
      expect(sent[0]).not.toHaveProperty("replyTo");
    });

    it("says where someone joining the chat is in school", async () => {
      const email = alert("Sam wants to join the chat");
      const join = { ...CONTACT, kind: "join", name: "Sam Example", message: null, details: { band: "hs" } };
      const { deps, sent } = fakes([email], { [email.id]: join });

      await drainEmails(deps);

      expect(sent[0].text).toContain("Sam Example wants to join the group chat.");
      expect(sent[0].text).toContain("In high school");
    });

    it("marks a staging message as a test, with no Reply-To, so nobody else hears about it", async () => {
      const email = alert("Maya sent a message");
      const { deps, sent } = fakes(
        [email],
        { [email.id]: { ...CONTACT, env: "staging" } },
        { env: { ...PRODUCTION, appEnv: "staging" } },
      );

      await drainEmails(deps);

      expect(sent[0].text).toContain("A test from the staging site.");
      expect(sent[0]).not.toHaveProperty("replyTo");
    });

    it("marks failed an alert whose message is gone", async () => {
      const email = alert("Maya sent a message");
      const { deps, sent, marked } = fakes([email], {});

      await drainEmails(deps);

      expect(sent).toEqual([]);
      expect(marked).toEqual([
        { id: email.id, status: "failed", error: "Couldn't build the email: its details are missing" },
      ]);
    });
  });

  it("marks failed, and never sends, an email it doesn't write, like an invite stuck sending", async () => {
    const email = queued("001", { template: "invite", related_type: "invite" });
    const { deps, sent, marked } = fakes([email], {});

    const result = await drainEmails(deps);

    expect(result).toEqual({ status: "drained", sent: 0, failed: 1 });
    expect(sent).toEqual([]);
    expect(marked).toEqual([
      { id: email.id, status: "failed", error: "Couldn't build the email: the drain doesn't write invite emails" },
    ]);
  });

  it("marks failed an email whose details are gone", async () => {
    const email = queued("001");
    const { deps, sent, marked } = fakes([email], {});

    await drainEmails(deps);

    expect(sent).toEqual([]);
    expect(marked).toEqual([
      { id: email.id, status: "failed", error: "Couldn't build the email: its details are missing" },
    ]);
  });

  it("marks sent, without sending again, an email Resend already took on an earlier try", async () => {
    const email = queued("001", { resend_id: "re_earlier" });
    const { deps, sent, marked } = fakes([email], { [email.id]: SUBMITTED });

    const result = await drainEmails(deps);

    expect(result).toEqual({ status: "drained", sent: 1, failed: 0 });
    expect(sent).toEqual([]);
    expect(marked).toEqual([{ id: email.id, status: "sent", resendId: "re_earlier" }]);
  });

  it("marks one failed with Resend's error and goes on to the next", async () => {
    const first = queued("001");
    const second = queued("002", { to_address: "second@example.test" });
    let calls = 0;
    const { deps, marked } = fakes(
      [first, second],
      { [first.id]: SUBMITTED, [second.id]: SUBMITTED },
      {
        send: async () => (++calls === 1 ? { error: "validation_error: Bad address" } : { id: "re_2" }),
      },
    );

    const result = await drainEmails(deps);

    expect(result).toEqual({ status: "drained", sent: 1, failed: 1 });
    expect(marked).toEqual([
      { id: first.id, status: "failed", error: "validation_error: Bad address" },
      { id: second.id, status: "sent", resendId: "re_2" },
    ]);
  });

  it("keeps claiming until the outbox is empty, pausing between sends for Resend's rate limit", async () => {
    const rows = ["001", "002", "003", "004", "005", "006", "007"].map((id) => queued(id));
    const details = Object.fromEntries(rows.map((row) => [row.id, SUBMITTED]));
    const { deps, claims, sent, pauses } = fakes(rows, details);

    const result = await drainEmails(deps);

    expect(result).toEqual({ status: "drained", sent: 7, failed: 0 });
    expect(sent).toHaveLength(7);
    // Two full batches, then an empty one.
    expect(claims).toHaveLength(3);
    expect(pauses).toEqual([600, 600, 600, 600, 600, 600]);
  });

  it("stops claiming once it has run for 20 seconds, leaving the rest queued for the next poke", async () => {
    const rows = ["001", "002", "003", "004", "005", "006"].map((id) => queued(id));
    const details = Object.fromEntries(rows.map((row) => [row.id, SUBMITTED]));
    let clock = 0;
    let sends = 0;
    const { deps, outbox } = fakes(rows, details, {
      now: () => clock,
      send: async () => {
        clock += 5_000;
        return { id: `re_${++sends}` };
      },
    });

    const result = await drainEmails(deps);

    // The first batch of five took 25 seconds, so it didn't claim another.
    expect(result).toEqual({ status: "drained", sent: 5, failed: 0 });
    expect(outbox).toHaveLength(1);
  });

  it("never sends a row twice when two drains run at once", async () => {
    const rows = ["001", "002", "003", "004", "005", "006", "007", "008"].map((id) => queued(id));
    const details = Object.fromEntries(rows.map((row) => [row.id, SUBMITTED]));
    const { deps, sent } = fakes(rows, details);

    const [one, two] = await Promise.all([drainEmails(deps), drainEmails(deps)]);

    expect(sent.map((email) => email.idempotencyKey).sort()).toEqual(rows.map((row) => row.id));
    expect((one.status === "drained" ? one.sent : 0) + (two.status === "drained" ? two.sent : 0)).toBe(8);
  });

  it("leaves everything queued when email isn't set up", async () => {
    const { deps, claims, sent } = fakes([queued("001")], {}, { env: { ...PRODUCTION, sending: null } });

    expect(await drainEmails(deps)).toEqual({ status: "off" });
    expect(claims).toEqual([]);
    expect(sent).toEqual([]);
  });

  describe("the daily digest", () => {
    const TAKEDOWN_ID = "00000000-0000-4000-8000-0000000000f1";
    const VISIT_ID = "00000000-0000-4000-8000-0000000000f2";
    const SERVE_ID = "00000000-0000-4000-8000-0000000000f3";
    const digestEmail = (subject: string) =>
      queued("0d1", {
        template: "daily-digest",
        to_address: "youth@example.test",
        subject,
        related_type: null,
        related_id: null,
      });
    const TAKEDOWN = {
      id: TAKEDOWN_ID,
      kind: "takedown",
      name: "Pat Example",
      email: "pat@example.test",
      phone: null,
      message: "Please take down the photo from Friday.",
      details: { role: "parent" },
      created_at: "2026-10-02T23:05:00Z",
    };
    const VISIT = {
      id: VISIT_ID,
      kind: "visit",
      name: "Vi Example",
      email: null,
      phone: "555-555-0101",
      message: "Coming Friday.",
      details: {},
      created_at: "2026-10-02T22:14:00Z",
    };
    const SERVE = {
      id: SERVE_ID,
      kind: "serve",
      name: "Sam Example",
      email: "sam@example.test",
      phone: null,
      message: null,
      details: { areas: ["worship", "media"] },
      created_at: "2026-10-02T22:30:00Z",
    };

    /** A drain whose database queues `digest` when asked, listing `listed` messages, or nothing when it's null. */
    function digestFakes(
      rows: QueuedEmail[],
      digest: QueuedEmail | null,
      listed: number,
      details: Record<string, unknown>,
      overrides: Partial<DrainDeps> = {},
    ) {
      const made = fakes(rows, details, overrides);
      const queuedFor: { env: string; to: string }[] = [];
      made.deps.queueDigest = async (env, to) => {
        queuedFor.push({ env, to });
        if (!digest) return 0;
        made.outbox.push(digest);
        return listed;
      };
      return { ...made, queuedFor };
    }

    it("queues one digest for the youth inbox when the morning poke asks, and sends it with the rest", async () => {
      const alert = queued("001");
      const digest = digestEmail("3 messages from the website are waiting");
      const { deps, sent, queuedFor } = digestFakes([alert], digest, 3, {
        [alert.id]: SUBMITTED,
        [digest.id]: { env: "production", total: 3, messages: [TAKEDOWN, VISIT, SERVE] },
      });

      const result = await drainEmails(deps, { digest: true });

      expect(result).toEqual({ status: "drained", sent: 2, failed: 0, digest: 3 });
      expect(queuedFor).toEqual([{ env: "production", to: "youth@example.test" }]);
      expect(sent.map((email) => email.subject)).toEqual([
        "R-0042 is ready for review",
        "3 messages from the website are waiting",
      ]);
      expect(sent[1]).toMatchObject({ to: "youth@example.test", idempotencyKey: digest.id });
      expect(sent[1]).not.toHaveProperty("replyTo");
    });

    it("lists every waiting message in one email, in order, each with a way to write back and a link", async () => {
      const digest = digestEmail("3 messages from the website are waiting");
      const { deps, sent } = digestFakes([], digest, 3, {
        [digest.id]: { env: "production", total: 3, messages: [TAKEDOWN, VISIT, SERVE] },
      });

      await drainEmails(deps, { digest: true });

      expect(sent).toHaveLength(1);
      const { text, html } = sent[0];
      for (const line of [
        "3 messages from the website are waiting",
        "Pat Example asked us to take down a photo.",
        "Please take down the photo from Friday.",
        "pat@example.test",
        "Parent or guardian",
        "Vi Example is planning a visit.",
        "555-555-0101",
        "Sam Example wants to serve.",
        "Worship, Media",
        "Oct 2, 2026 at 3:14 PM",
        "Replying to this email won't reach them",
      ]) {
        expect(text).toContain(line);
      }
      expect(text.indexOf("Pat Example")).toBeLessThan(text.indexOf("Vi Example"));
      expect(text.indexOf("Vi Example")).toBeLessThan(text.indexOf("Sam Example"));
      for (const id of [TAKEDOWN_ID, VISIT_ID, SERVE_ID]) {
        expect(html).toContain(`href="https://portal.example.test/messages/${id}"`);
      }
      expect(html).toContain('href="https://portal.example.test/messages"');
    });

    it("says how many more are in the portal when there are too many to show", async () => {
      const digest = digestEmail("26 messages from the website are waiting");
      const shown = Array.from({ length: 20 }, (_, index) => ({ ...VISIT, name: `Guest${index + 1} Example` }));
      const { deps, sent } = digestFakes([], digest, 26, {
        [digest.id]: { env: "production", total: 26, messages: shown },
      });

      await drainEmails(deps, { digest: true });

      expect(sent).toHaveLength(1);
      expect(sent[0].text).toContain("Here are 20 of them. The other 6 are in the portal.");
      expect(sent[0].text).toContain("Guest20 Example is planning a visit.");
    });

    it("shortens a long message, since the portal has the rest", async () => {
      const digest = digestEmail("1 message from the website is waiting");
      const long = "Long question here. ".repeat(100).trim();
      const contact = { ...TAKEDOWN, kind: "contact", message: long };
      const { deps, sent } = digestFakes([], digest, 1, {
        [digest.id]: { env: "production", total: 1, messages: [contact] },
      });

      await drainEmails(deps, { digest: true });

      expect(sent[0].text).toContain("Long question here. Long question here.");
      expect(sent[0].text).toContain("…");
      expect(sent[0].text).not.toContain(long);
    });

    it("sends nothing when no message is waiting", async () => {
      const { deps, sent, queuedFor } = digestFakes([], null, 0, {});

      const result = await drainEmails(deps, { digest: true });

      expect(result).toEqual({ status: "drained", sent: 0, failed: 0, digest: 0 });
      expect(queuedFor).toHaveLength(1);
      expect(sent).toEqual([]);
    });

    it("never queues a digest on an ordinary poke", async () => {
      const { deps, queuedFor } = digestFakes([], digestEmail("1 message from the website is waiting"), 1, {});

      const result = await drainEmails(deps);

      expect(result).toEqual({ status: "drained", sent: 0, failed: 0 });
      expect(queuedFor).toEqual([]);
    });

    it("marks staging's digest as tests, for the address staging sends to", async () => {
      const digest = digestEmail("1 message from the website is waiting");
      const { deps, sent, queuedFor } = digestFakes(
        [],
        digest,
        1,
        { [digest.id]: { env: "staging", total: 1, messages: [SERVE] } },
        { env: { ...PRODUCTION, appEnv: "staging" }, digestTo: () => "owner@example.test" },
      );

      await drainEmails(deps, { digest: true });

      expect(queuedFor).toEqual([{ env: "staging", to: "owner@example.test" }]);
      expect(sent[0].text).toContain("Tests from the staging site.");
      expect(sent[0].text).not.toContain("Replying to this email");
    });

    it("skips the digest, still drains, and tells the owners when there's no inbox to send it to", async () => {
      const alert = queued("001");
      const { deps, sent, queuedFor, reports } = digestFakes(
        [alert],
        null,
        0,
        { [alert.id]: SUBMITTED },
        { digestTo: () => null },
      );

      const result = await drainEmails(deps, { digest: true });

      expect(result).toEqual({ status: "drained", sent: 1, failed: 0, digest: 0 });
      expect(queuedFor).toEqual([]);
      expect(sent).toHaveLength(1);
      expect(reports).toEqual([
        { source: "Daily digest", message: "Set YOUTH_INBOX_EMAIL so form messages reach the youth inbox." },
      ]);
    });

    it("names the owner alert address when staging has nowhere to send the digest", async () => {
      const { deps, reports } = digestFakes([], null, 0, {}, {
        env: { ...PRODUCTION, appEnv: "staging" },
        digestTo: () => null,
      });

      await drainEmails(deps, { digest: true });

      expect(reports).toEqual([
        { source: "Daily digest", message: "Set OWNER_ALERT_EMAIL so staging's form messages reach the owner." },
      ]);
    });

    it("still drains when the digest can't be queued, and reports it to the owners", async () => {
      const alert = queued("001");
      const { deps, sent, reports } = fakes(
        [alert],
        { [alert.id]: SUBMITTED },
        {
          queueDigest: async () => {
            throw new Error("Couldn't queue the digest: connect ECONNREFUSED");
          },
        },
      );

      const result = await drainEmails(deps, { digest: true });

      expect(result).toEqual({ status: "drained", sent: 1, failed: 0, digest: 0 });
      expect(sent).toHaveLength(1);
      expect(reports).toEqual([
        { source: "Daily digest", message: "Couldn't queue the digest: connect ECONNREFUSED" },
      ]);
    });

    it("marks failed a digest whose messages are gone", async () => {
      const digest = digestEmail("1 message from the website is waiting");
      const { deps, sent, marked } = digestFakes([], digest, 1, {});

      await drainEmails(deps, { digest: true });

      expect(sent).toEqual([]);
      expect(marked).toEqual([
        { id: digest.id, status: "failed", error: "Couldn't build the email: its details are missing" },
      ]);
    });
  });

  it("claims only staging's own emails on staging", async () => {
    const { deps, claims } = fakes([], {}, { env: { ...PRODUCTION, appEnv: "staging" } });

    await drainEmails(deps);

    expect(claims).toEqual([{ env: "staging", limit: 5 }]);
  });
});

describe("handleDrainRequest", () => {
  function poke(authorization?: string) {
    return new Request("https://portal.example.test/api/email/drain", {
      method: "POST",
      headers: { "content-type": "application/json", ...(authorization ? { authorization } : {}) },
      body: "{}",
    });
  }

  it("drains with the shared secret", async () => {
    let drained = 0;
    const response = await handleDrainRequest(poke("Bearer test-drain-secret"), {
      secret: "test-drain-secret",
      drain: async () => {
        drained++;
        return { status: "drained", sent: 2, failed: 0 };
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "drained", sent: 2, failed: 0 });
    expect(drained).toBe(1);
  });

  it("asks for the digest only when the database pokes with ?digest=1", async () => {
    const asked: unknown[] = [];
    const drain = async (options: { digest: boolean }) => {
      asked.push(options);
      return { status: "drained" as const, sent: 0, failed: 0 };
    };
    const morning = new Request("https://portal.example.test/api/email/drain?digest=1", {
      method: "POST",
      headers: { authorization: "Bearer test-drain-secret" },
      body: "{}",
    });

    await handleDrainRequest(morning, { secret: "test-drain-secret", drain });
    await handleDrainRequest(poke("Bearer test-drain-secret"), { secret: "test-drain-secret", drain });

    expect(asked).toEqual([{ digest: true }, { digest: false }]);
  });

  it.each([
    ["no secret", undefined],
    ["the wrong secret", "Bearer not-the-secret"],
    ["the secret without Bearer", "test-drain-secret"],
    ["a longer secret that starts the same", "Bearer test-drain-secret-and-more"],
  ])("answers 401 to a request with %s, and never drains", async (_, authorization) => {
    let drained = 0;
    const response = await handleDrainRequest(poke(authorization), {
      secret: "test-drain-secret",
      drain: async () => {
        drained++;
        return { status: "off" };
      },
    });

    expect(response.status).toBe(401);
    expect(drained).toBe(0);
  });

  it("answers 503 when the drain has no secret set up", async () => {
    const response = await handleDrainRequest(poke("Bearer anything"), {
      secret: null,
      drain: async () => ({ status: "off" }),
    });

    expect(response.status).toBe(503);
  });

  it("answers 500 when the outbox can't be read, and reports it to the owners", async () => {
    const reported: unknown[] = [];
    const response = await handleDrainRequest(poke("Bearer test-drain-secret"), {
      secret: "test-drain-secret",
      drain: async () => {
        throw new Error("connect ECONNREFUSED");
      },
      report: (error) => reported.push(error),
    });

    expect(response.status).toBe(500);
    expect(reported).toEqual([new Error("connect ECONNREFUSED")]);
  });
});

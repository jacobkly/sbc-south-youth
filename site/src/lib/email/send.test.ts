import { createElement } from "react";
import { describe, expect, it } from "vitest";
import type { EmailEnv } from "@/lib/env";
import {
  EMAIL_PRIORITY,
  sendEmail,
  type EmailDeps,
  type EmailMessage,
  type OutgoingEmail,
  type ReserveInput,
} from "./send";

const LOG_ID = "00000000-0000-4000-8000-00000000e001";

const PRODUCTION: EmailEnv = {
  appEnv: "production",
  sending: { apiKey: "re_test", from: "Example Youth <hello@mail.example.test>" },
  ownerAlertEmail: "owner@example.test",
  webhookSecret: null,
  drainSecret: null,
};

const message: EmailMessage = {
  template: "invite",
  priority: EMAIL_PRIORITY.invite,
  to: "Leader@Example.test",
  subject: "You're invited to the portal",
  scope: "platform",
  related: { type: "invite", id: "00000000-0000-4000-8000-0000000000a1" },
  body: createElement("p", null, "Welcome"),
};

/** Fakes for the database and Resend that record every call. */
function fakes(overrides: Partial<EmailDeps> = {}) {
  const reserved: ReserveInput[] = [];
  const sent: OutgoingEmail[] = [];
  const marked: Parameters<EmailDeps["mark"]>[0][] = [];
  const reports: { source: string; message: string }[] = [];
  const deps: EmailDeps = {
    env: PRODUCTION,
    reserve: async (input) => {
      reserved.push(input);
      return { id: LOG_ID, status: "sending" };
    },
    send: async (email) => {
      sent.push(email);
      return { id: "re_sent_1" };
    },
    mark: async (input) => {
      marked.push(input);
    },
    render: async () => ({ html: "<p>Welcome</p>", text: "Welcome" }),
    report: (source, error) => {
      reports.push({ source, message: error instanceof Error ? error.message : String(error) });
    },
    ...overrides,
  };
  return { deps, reserved, sent, marked, reports };
}

describe("sendEmail", () => {
  it("logs the email, sends it once with its log ID as the idempotency key, and marks it sent", async () => {
    const { deps, reserved, sent, marked } = fakes();

    const result = await sendEmail(message, deps);

    expect(result).toEqual({ status: "sent", logId: LOG_ID });
    expect(reserved).toEqual([
      {
        template: "invite",
        priority: 2,
        to: "Leader@Example.test",
        subject: "You're invited to the portal",
        scope: "platform",
        env: "production",
        relatedType: "invite",
        relatedId: "00000000-0000-4000-8000-0000000000a1",
      },
    ]);
    expect(sent).toEqual([
      {
        from: "Example Youth <hello@mail.example.test>",
        to: "Leader@Example.test",
        subject: "You're invited to the portal",
        html: "<p>Welcome</p>",
        text: "Welcome",
        idempotencyKey: LOG_ID,
        tags: [
          { name: "log_id", value: LOG_ID },
          { name: "template", value: "invite" },
        ],
      },
    ]);
    expect(marked).toEqual([{ id: LOG_ID, status: "sent", resendId: "re_sent_1" }]);
  });

  it.each(["skipped_quota", "suppressed"] as const)("never calls Resend for a %s email", async (status) => {
    const { deps, sent, marked } = fakes({ reserve: async () => ({ id: LOG_ID, status }) });

    const result = await sendEmail(message, deps);

    expect(result).toEqual({ status, logId: LOG_ID });
    expect(sent).toEqual([]);
    expect(marked).toEqual([]);
  });

  it("sends every staging email to the owner alert address instead, and says so in the subject", async () => {
    const { deps, reserved, sent } = fakes({ env: { ...PRODUCTION, appEnv: "staging" } });

    await sendEmail(message, deps);

    expect(reserved[0]).toMatchObject({
      to: "owner@example.test",
      env: "staging",
      subject: "[Staging for leader@example.test] You're invited to the portal",
    });
    expect(sent[0]).toMatchObject({
      to: "owner@example.test",
      subject: "[Staging for leader@example.test] You're invited to the portal",
    });
  });

  it("sends nothing on staging without an owner alert address", async () => {
    const { deps, reserved, sent } = fakes({ env: { ...PRODUCTION, appEnv: "staging", ownerAlertEmail: null } });

    const result = await sendEmail(message, deps);

    expect(result.status).toBe("off");
    expect(reserved).toEqual([]);
    expect(sent).toEqual([]);
  });

  it("logs and sends nothing when email isn't set up", async () => {
    const { deps, reserved, sent } = fakes({ env: { ...PRODUCTION, sending: null } });

    const result = await sendEmail(message, deps);

    expect(result.status).toBe("off");
    expect(reserved).toEqual([]);
    expect(sent).toEqual([]);
  });

  it("marks the email failed with Resend's error, without throwing", async () => {
    const { deps, marked } = fakes({
      send: async () => ({ error: "validation_error: The from address isn't verified." }),
    });

    const result = await sendEmail(message, deps);

    expect(result).toEqual({
      status: "failed",
      logId: LOG_ID,
      error: "validation_error: The from address isn't verified.",
    });
    expect(marked).toEqual([
      { id: LOG_ID, status: "failed", error: "validation_error: The from address isn't verified." },
    ]);
  });

  it("marks the email failed when the request to Resend throws", async () => {
    const { deps, marked } = fakes({
      send: async () => {
        throw new Error("fetch failed");
      },
    });

    const result = await sendEmail(message, deps);

    expect(result).toMatchObject({ status: "failed", logId: LOG_ID, error: "fetch failed" });
    expect(marked).toEqual([{ id: LOG_ID, status: "failed", error: "fetch failed" }]);
  });

  it("marks the email failed when it can't be built, and never sends it", async () => {
    const { deps, sent, marked } = fakes({
      render: async () => {
        throw new Error("Cannot read properties of undefined");
      },
    });

    const result = await sendEmail(message, deps);

    expect(result.status).toBe("failed");
    expect(sent).toEqual([]);
    expect(marked).toEqual([
      { id: LOG_ID, status: "failed", error: "Couldn't build the email: Cannot read properties of undefined" },
    ]);
  });

  it("reports a failure without throwing when the log can't be written", async () => {
    const { deps, sent, reports } = fakes({
      reserve: async () => {
        throw new Error("connect ECONNREFUSED");
      },
    });

    const result = await sendEmail(message, deps);

    expect(result).toEqual({ status: "failed", logId: null, error: "connect ECONNREFUSED" });
    expect(sent).toEqual([]);
    // The email log never got a row, so the owners' error log is the only place it shows.
    expect(reports).toEqual([{ source: "Send the invite email", message: "connect ECONNREFUSED" }]);
  });

  it("leaves a failed send to the email log, where owners already see it", async () => {
    const { deps, reports } = fakes({ send: async () => ({ error: "The domain isn't verified" }) });

    expect((await sendEmail(message, deps)).status).toBe("failed");
    expect(reports).toEqual([]);
  });

  it("still reports a sent email as sent when marking it fails, since the webhook fills it in", async () => {
    const { deps } = fakes({
      mark: async () => {
        throw new Error("connect ECONNREFUSED");
      },
    });

    expect(await sendEmail(message, deps)).toEqual({ status: "sent", logId: LOG_ID });
  });
});

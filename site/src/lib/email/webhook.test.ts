import { createHmac, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { handleResendWebhook, type WebhookRecord } from "./webhook";

const SECRET = `whsec_${randomBytes(24).toString("base64")}`;
const LOG_ID = "00000000-0000-4000-8000-00000000e001";

/** A Resend event as it arrives: JSON in the body and Svix's signature headers. */
function request(body: string, { secret = SECRET, at = new Date(), sign = true } = {}) {
  const headers = new Headers({ "content-type": "application/json" });
  if (sign) {
    const id = "msg_test_1";
    const timestamp = Math.floor(at.getTime() / 1000).toString();
    const key = Buffer.from(secret.slice("whsec_".length), "base64");
    const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
    headers.set("svix-id", id);
    headers.set("svix-timestamp", timestamp);
    headers.set("svix-signature", `v1,${signature}`);
  }
  return new Request("https://portal.example.test/api/webhooks/resend", { method: "POST", headers, body });
}

function event(type: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    type,
    created_at: "2026-10-02T17:00:05.000Z",
    data: {
      email_id: "4ef9a417-02e9-4d39-ad75-9611e0fcc33c",
      created_at: "2026-10-02T17:00:00.000Z",
      from: "Example Youth <hello@mail.example.test>",
      to: ["leader@example.test"],
      subject: "You're invited to the portal",
      message_id: "<0100018f.example@email.example.test>",
      tags: { log_id: LOG_ID, template: "invite" },
      ...extra,
    },
  });
}

function recorder() {
  const recorded: WebhookRecord[] = [];
  return { recorded, record: async (row: WebhookRecord) => void recorded.push(row) };
}

describe("handleResendWebhook", () => {
  it("records a signed delivery against its log row", async () => {
    const { recorded, record } = recorder();

    const response = await handleResendWebhook(request(event("email.delivered")), { secret: SECRET, record });

    expect(response.status).toBe(200);
    expect(recorded).toEqual([
      {
        resendId: "4ef9a417-02e9-4d39-ad75-9611e0fcc33c",
        status: "delivered",
        logId: LOG_ID,
        to: "leader@example.test",
        subject: "You're invited to the portal",
        error: null,
        at: "2026-10-02T17:00:05.000Z",
      },
    ]);
  });

  it("rejects an unsigned request with 401", async () => {
    const { recorded, record } = recorder();

    const response = await handleResendWebhook(request(event("email.delivered"), { sign: false }), {
      secret: SECRET,
      record,
    });

    expect(response.status).toBe(401);
    expect(recorded).toEqual([]);
  });

  it("rejects a request signed with another secret with 401", async () => {
    const { recorded, record } = recorder();
    const other = `whsec_${randomBytes(24).toString("base64")}`;

    const response = await handleResendWebhook(request(event("email.bounced"), { secret: other }), {
      secret: SECRET,
      record,
    });

    expect(response.status).toBe(401);
    expect(recorded).toEqual([]);
  });

  it("rejects a body changed after signing with 401", async () => {
    const { recorded, record } = recorder();
    const signed = request(event("email.delivered"));
    const tampered = new Request(signed.url, {
      method: "POST",
      headers: signed.headers,
      body: event("email.complained"),
    });

    const response = await handleResendWebhook(tampered, { secret: SECRET, record });

    expect(response.status).toBe(401);
    expect(recorded).toEqual([]);
  });

  it("rejects a replayed request from 10 minutes ago with 401", async () => {
    const { recorded, record } = recorder();
    const at = new Date(Date.now() - 10 * 60 * 1000);

    const response = await handleResendWebhook(request(event("email.delivered"), { at }), { secret: SECRET, record });

    expect(response.status).toBe(401);
    expect(recorded).toEqual([]);
  });

  it("answers 503 and records nothing when no secret is set", async () => {
    const { recorded, record } = recorder();

    const response = await handleResendWebhook(request(event("email.delivered")), { secret: null, record });

    expect(response.status).toBe(503);
    expect(recorded).toEqual([]);
  });

  it.each<[string, Partial<WebhookRecord>, Record<string, unknown>]>([
    ["email.sent", { status: "sent", error: null }, {}],
    [
      "email.failed",
      { status: "failed", error: "The domain isn't verified." },
      { failed: { reason: "The domain isn't verified." } },
    ],
    [
      "email.bounced",
      { status: "bounced", error: "The mailbox doesn't exist." },
      { bounce: { message: "The mailbox doesn't exist.", subType: "General", type: "Permanent" } },
    ],
    ["email.complained", { status: "complained", error: null }, {}],
    [
      "email.suppressed",
      { status: "bounced", error: "Resend didn't send it: The address bounced before." },
      { suppressed: { message: "The address bounced before.", type: "bounce" } },
    ],
    [
      "email.suppressed",
      { status: "complained", error: "Resend didn't send it: The person marked mail as spam." },
      { suppressed: { message: "The person marked mail as spam.", type: "complaint" } },
    ],
  ])("records %s as %j", async (type, expected, extra) => {
    const { recorded, record } = recorder();

    const response = await handleResendWebhook(request(event(type, extra)), { secret: SECRET, record });

    expect(response.status).toBe(200);
    expect(recorded).toEqual([expect.objectContaining(expected)]);
  });

  it.each(["email.opened", "email.clicked", "email.delivery_delayed", "email.scheduled", "contact.created"])(
    "accepts %s without recording it",
    async (type) => {
      const { recorded, record } = recorder();

      const response = await handleResendWebhook(request(event(type)), { secret: SECRET, record });

      expect(response.status).toBe(200);
      expect(recorded).toEqual([]);
    },
  );

  it("treats an email without our log tag as Supabase Auth's own mail", async () => {
    const { recorded, record } = recorder();

    await handleResendWebhook(request(event("email.sent", { tags: undefined })), { secret: SECRET, record });

    expect(recorded).toEqual([expect.objectContaining({ logId: null, to: "leader@example.test" })]);
  });

  it("ignores a log tag that isn't an ID", async () => {
    const { recorded, record } = recorder();

    await handleResendWebhook(request(event("email.sent", { tags: { log_id: "'; drop table" } })), {
      secret: SECRET,
      record,
    });

    expect(recorded).toEqual([expect.objectContaining({ logId: null })]);
  });

  it("rejects a signed body that isn't an email event with 400", async () => {
    const { recorded, record } = recorder();

    const response = await handleResendWebhook(request(JSON.stringify({ type: "email.sent", data: {} })), {
      secret: SECRET,
      record,
    });

    expect(response.status).toBe(400);
    expect(recorded).toEqual([]);
  });

  it("answers 500 when the log can't be written, so Resend tries again, and reports it", async () => {
    const record = async () => {
      throw new Error("connect ECONNREFUSED");
    };
    const reported: unknown[] = [];

    const response = await handleResendWebhook(request(event("email.delivered")), {
      secret: SECRET,
      record,
      report: (error) => reported.push(error),
    });

    expect(response.status).toBe(500);
    expect(reported).toEqual([new Error("connect ECONNREFUSED")]);
  });
});

import "server-only";
import { Resend } from "resend";
import { z } from "zod";
import type { EmailWebhookEvent } from "@/lib/supabase/admin";

export type WebhookRecord = EmailWebhookEvent;

/** Resend's delivery events, as statuses in the email log. Others (opens, clicks) aren't tracked. */
const statusFor: Record<string, WebhookRecord["status"]> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.failed": "failed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.suppressed": "bounced",
};

const reason = z.object({ message: z.string().optional(), reason: z.string().optional(), type: z.string().optional() });

const emailEvent = z.object({
  type: z.string(),
  created_at: z.string().optional(),
  data: z.object({
    email_id: z.string().min(1).max(100),
    to: z.array(z.string()).optional(),
    subject: z.string().optional(),
    tags: z.unknown().optional(),
    failed: reason.optional(),
    bounce: reason.optional(),
    suppressed: reason.optional(),
  }),
});

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads one tag, whether Resend sends tags as an object or as name/value pairs. */
function tag(tags: unknown, name: string): string | null {
  const value = Array.isArray(tags)
    ? tags.find((item) => item && typeof item === "object" && item.name === name)?.value
    : tags && typeof tags === "object"
      ? (tags as Record<string, unknown>)[name]
      : undefined;
  return typeof value === "string" ? value : null;
}

function header(request: Request, name: string): string | null {
  return request.headers.get(`svix-${name}`) ?? request.headers.get(`webhook-${name}`);
}

/** Only checks signatures, which happens locally, so it never needs the real API key. */
let verifier: Resend | undefined;

function text(status: number, body: string): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

/**
 * Records Resend's delivery events in the email log. Every request must be
 * signed with the webhook's secret within the last five minutes, so nobody
 * else can mark an email bounced. Resend retries anything but a 2xx for a
 * while, so events we don't track still get a 200.
 */
export async function handleResendWebhook(
  request: Request,
  { secret, record }: { secret: string | null; record: (row: WebhookRecord) => Promise<void> },
): Promise<Response> {
  if (!secret) return text(503, "Email webhooks aren't set up.");

  const id = header(request, "id");
  const timestamp = header(request, "timestamp");
  const signature = header(request, "signature");
  const payload = await request.text();
  if (!id || !timestamp || !signature) return text(401, "Missing signature.");

  let body: unknown;
  try {
    verifier ??= new Resend("re_signature_only");
    body = verifier.webhooks.verify({ payload, headers: { id, timestamp, signature }, webhookSecret: secret });
  } catch {
    return text(401, "Bad signature.");
  }

  const type = z.object({ type: z.string() }).safeParse(body);
  if (!type.success) return text(400, "Not a Resend event.");
  const status = statusFor[type.data.type];
  if (!status) return text(200, "Ignored.");

  const event = emailEvent.safeParse(body);
  if (!event.success) return text(400, "Not an email event.");
  const { data, created_at } = event.data;
  // Our sends carry their log row's ID. Supabase Auth's codes don't, so they get a row of their own.
  const logId = tag(data.tags, "log_id");

  let row: WebhookRecord = {
    resendId: data.email_id,
    status,
    logId: logId && uuid.test(logId) ? logId : null,
    to: data.to?.[0] ?? null,
    subject: data.subject ?? null,
    error: null,
    at: created_at && !Number.isNaN(Date.parse(created_at)) ? created_at : null,
  };
  if (type.data.type === "email.failed") {
    row = { ...row, error: data.failed?.reason ?? data.failed?.message ?? null };
  } else if (type.data.type === "email.bounced") {
    row = { ...row, error: data.bounce?.message ?? null };
  } else if (type.data.type === "email.suppressed") {
    // Resend skipped it: the address bounced or complained on another send.
    const complaint = /complain/i.test(data.suppressed?.type ?? "");
    row = {
      ...row,
      status: complaint ? "complained" : "bounced",
      error: `Resend didn't send it: ${data.suppressed?.message ?? "the address is on Resend's suppression list."}`,
    };
  }

  try {
    await record(row);
  } catch (error) {
    console.error("[email] Couldn't record a Resend webhook", error);
    return text(500, "Couldn't record the event.");
  }
  return text(200, "Recorded.");
}

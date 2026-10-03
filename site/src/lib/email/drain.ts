import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { ReactElement } from "react";
import { z } from "zod";
import { Constants } from "@/lib/database.types";
import { readEmailEnv, readPortalEnv, type AppEnv, type EmailEnv } from "@/lib/env";
import { emailClaim, emailDetails, emailMark, type ClaimedEmail, type EmailMark } from "@/lib/supabase/admin";
import { renderEmail, type RenderedEmail } from "./render";
import { deliverEmail, type OutgoingEmail } from "./send";
import { ownerChangedEmail } from "./templates/owner-changed";
import { requestPaidEmail } from "./templates/request-paid";
import { requestReturnedEmail } from "./templates/request-returned";
import { requestSubmittedEmail } from "./templates/request-submitted";

/**
 * The outbox drain. The database queues finance and owner emails in
 * email_log and pokes the portal, which claims a few at a time, writes
 * them, sends them through Resend, and records what happened.
 */

export type QueuedEmail = ClaimedEmail;

/** Where an email's button goes. */
export type DrainLinks = { financesUrl: string; portalUrl: string };

/** Everything drainEmails() talks to, so tests can swap in fakes. */
export type DrainDeps = {
  env: EmailEnv;
  links: DrainLinks;
  claim: (env: AppEnv, limit: number) => Promise<QueuedEmail[]>;
  details: (id: string) => Promise<unknown>;
  send: (email: OutgoingEmail) => Promise<{ id: string } | { error: string }>;
  mark: (input: EmailMark) => Promise<void>;
  render: (body: ReactElement) => Promise<RenderedEmail>;
  pause: (ms: number) => Promise<void>;
  /** Milliseconds, for the time budget. */
  now: () => number;
};

export type DrainResult = { status: "off" } | { status: "drained"; sent: number; failed: number };

/** How many emails one claim takes. A crash leaves at most this many waiting out the 15-minute retry. */
const BATCH_SIZE = 5;
/** Resend allows two requests a second. */
const SEND_GAP_MS = 600;
/** No new claim after this long, so a big outbox can't run into the route's time limit. The next poke finishes it. */
const TIME_BUDGET_MS = 20_000;

/** What email_details() returns for a request email. Each template uses only its own fields. */
const requestDetails = z.object({
  amount_cents: z.number().int(),
  vendor: z.string().nullable(),
  by: z.string().nullable(),
  payee: z.string().nullable(),
  by_payee: z.boolean().nullable(),
  description: z.string().nullable(),
  note: z.string().nullable(),
  payment_method: z.enum(Constants.public.Enums.payment_method).nullable(),
  paid_at: z.string().nullable(),
});

const ownerDetails = z.object({ name: z.string(), by: z.string().nullable() });

type Addressed = QueuedEmail & { subject: string; related_id: string };

/** Each template the drain writes. Null means the details didn't fit it. */
const TEMPLATES: Record<string, (email: Addressed, details: unknown, links: DrainLinks) => ReactElement | null> = {
  "request-submitted": (email, details, { financesUrl }) => {
    const parsed = requestDetails.safeParse(details);
    if (!parsed.success || !parsed.data.payee) return null;
    const { amount_cents, vendor, description, by, payee, by_payee } = parsed.data;
    return requestSubmittedEmail({
      subject: email.subject,
      amountCents: amount_cents,
      vendor,
      description,
      by,
      byPayee: by_payee === true,
      payee,
      url: `${financesUrl}/admin/requests/${email.related_id}`,
    });
  },
  "request-returned": (email, details, { financesUrl }) => {
    const parsed = requestDetails.safeParse(details);
    if (!parsed.success) return null;
    const { amount_cents, vendor, by, note } = parsed.data;
    return requestReturnedEmail({
      subject: email.subject,
      amountCents: amount_cents,
      vendor,
      by,
      note,
      url: `${financesUrl}/my/${email.related_id}`,
    });
  },
  "request-paid": (email, details, { financesUrl }) => {
    const parsed = requestDetails.safeParse(details);
    if (!parsed.success) return null;
    const { amount_cents, vendor, payment_method, paid_at } = parsed.data;
    return requestPaidEmail({
      subject: email.subject,
      amountCents: amount_cents,
      vendor,
      paymentMethod: payment_method,
      paidAt: paid_at,
      url: `${financesUrl}/my/${email.related_id}`,
    });
  },
  "owner-changed": (email, details, { portalUrl }) => {
    const parsed = ownerDetails.safeParse(details);
    if (!parsed.success) return null;
    return ownerChangedEmail({
      subject: email.subject,
      by: parsed.data.by,
      at: email.created_at,
      url: `${portalUrl}/people`,
    });
  },
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type Built = { to: string; subject: string; body: ReactElement };

/** Writes one queued email, or says why it can't. */
async function build(email: QueuedEmail, deps: DrainDeps): Promise<Built | { problem: string }> {
  if (!Object.hasOwn(TEMPLATES, email.template)) {
    return { problem: `the drain doesn't write ${email.template} emails` };
  }
  const { to_address: to, subject, related_id } = email;
  if (!to || !subject || !related_id) return { problem: "its details are missing" };
  const body = TEMPLATES[email.template]({ ...email, subject, related_id }, await deps.details(email.id), deps.links);
  return body ? { to, subject, body } : { problem: "its details are missing" };
}

/** Records a result. The row stays `sending` if this fails, and a later drain retries it under the same key. */
async function markQuietly(mark: DrainDeps["mark"], input: EmailMark): Promise<void> {
  try {
    await mark(input);
  } catch (error) {
    console.error(`[email] Couldn't mark the queued email ${input.status}`, error);
  }
}

/**
 * Sends everything queued for this environment, a few at a time, until the
 * outbox is empty or the time budget runs out. Each row is claimed once, so
 * two drains running together never send the same email, and its log ID is
 * Resend's idempotency key, so a retried row can't go out twice either.
 * Only reading the outbox throws: one bad email is marked failed and the
 * drain goes on.
 */
export async function drainEmails(deps: DrainDeps = defaultDrainDeps()): Promise<DrainResult> {
  const { env } = deps;
  if (!env.sending) return { status: "off" };
  const { from } = env.sending;
  const started = deps.now();
  const result = { status: "drained" as const, sent: 0, failed: 0 };
  let sentOne = false;

  const deliver = async (email: QueuedEmail): Promise<"sent" | "failed"> => {
    const fail = async (error: string) => {
      console.error(`[email] The queued ${email.template} email failed: ${error}`);
      await markQuietly(deps.mark, { id: email.id, status: "failed", error });
      return "failed" as const;
    };

    // Resend took it on an earlier try that never got marked.
    if (email.resend_id) {
      await markQuietly(deps.mark, { id: email.id, status: "sent", resendId: email.resend_id });
      return "sent";
    }

    let built: Built;
    let rendered: RenderedEmail;
    try {
      const attempt = await build(email, deps);
      if ("problem" in attempt) return fail(`Couldn't build the email: ${attempt.problem}`);
      built = attempt;
      rendered = await deps.render(built.body);
    } catch (error) {
      return fail(`Couldn't build the email: ${messageOf(error)}`);
    }

    if (sentOne) await deps.pause(SEND_GAP_MS);
    sentOne = true;

    let sent: Awaited<ReturnType<DrainDeps["send"]>>;
    try {
      sent = await deps.send({
        from,
        to: built.to,
        subject: built.subject,
        html: rendered.html,
        text: rendered.text,
        idempotencyKey: email.id,
        tags: [
          { name: "log_id", value: email.id },
          { name: "template", value: email.template },
        ],
      });
    } catch (error) {
      return fail(messageOf(error));
    }
    if ("error" in sent) return fail(sent.error);

    // If this fails, Resend's `email.sent` webhook carries the log tag and fills it in.
    await markQuietly(deps.mark, { id: email.id, status: "sent", resendId: sent.id });
    return "sent";
  };

  while (deps.now() - started < TIME_BUDGET_MS) {
    const batch = await deps.claim(env.appEnv, BATCH_SIZE);
    if (batch.length === 0) break;
    for (const email of batch) result[await deliver(email)]++;
  }
  return result;
}

function text(status: number, body: string): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

/** Compares in constant time. Hashing first makes both sides the same length. */
function sameSecret(given: string, secret: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(secret));
}

/**
 * The database's poke. Only the database knows the secret, so nobody else
 * can make the portal spend the email quota, and the drain only ever sends
 * what the database already queued.
 */
export async function handleDrainRequest(
  request: Request,
  { secret, drain }: { secret: string | null; drain: () => Promise<DrainResult> },
): Promise<Response> {
  if (!secret) return text(503, "The email drain isn't set up.");

  const bearer = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "");
  if (!bearer || !sameSecret(bearer[1], secret)) return text(401, "Wrong secret.");

  try {
    return Response.json(await drain());
  } catch (error) {
    console.error("[email] The drain failed", error);
    return text(500, "Couldn't drain the outbox.");
  }
}

/** The real database and Resend (or the local inbox in development), read fresh each poke. */
function defaultDrainDeps(): DrainDeps {
  const env = readEmailEnv();
  const { financesUrl, portalUrl } = readPortalEnv();
  const { sending } = env;
  return {
    env,
    links: { financesUrl, portalUrl },
    claim: emailClaim,
    details: emailDetails,
    send: async (email) => (sending ? deliverEmail(sending, email) : { error: "Email isn't set up" }),
    mark: emailMark,
    render: renderEmail,
    pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
  };
}

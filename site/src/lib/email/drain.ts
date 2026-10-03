import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { ReactElement } from "react";
import { z } from "zod";
import { Constants } from "@/lib/database.types";
import { readEmailEnv, readFormEnv, readPortalEnv, type AppEnv, type EmailEnv } from "@/lib/env";
import { reportError } from "@/lib/errors/report";
import { answersOf, messageAnswers } from "@/lib/forms/answers";
import {
  emailClaim,
  emailDetails,
  emailMark,
  queueMessageDigest,
  type ClaimedEmail,
  type EmailMark,
} from "@/lib/supabase/admin";
import { renderEmail, type RenderedEmail } from "./render";
import { deliverEmail, type OutgoingEmail } from "./send";
import { dailyDigestEmail } from "./templates/daily-digest";
import { formAlertEmail } from "./templates/form-alert";
import { ownerChangedEmail } from "./templates/owner-changed";
import { quotaWarningEmail } from "./templates/quota-warning";
import { requestPaidEmail } from "./templates/request-paid";
import { requestReturnedEmail } from "./templates/request-returned";
import { requestSubmittedEmail } from "./templates/request-submitted";

/**
 * The outbox drain. The database queues finance, owner, and form emails
 * in email_log and pokes the portal, which claims a few at a time, writes
 * them, sends them through Resend, and records what happened. Each
 * morning's poke also queues the daily digest of messages whose alerts
 * never went.
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
  /** Queues the daily digest and returns how many messages it lists. */
  queueDigest: (env: AppEnv, to: string) => Promise<number>;
  /** Where the digest goes, the same inbox as the form alerts. Null when email is off. */
  digestTo: () => string | null;
  /** Puts an error on the owners' error log. A failed email is already on the Email screen, so it isn't one. */
  report: (source: string, error: unknown) => void;
};

/** `digest` is how many messages the morning's digest lists, only when the poke asked for it. */
export type DrainResult = { status: "off" } | { status: "drained"; sent: number; failed: number; digest?: number };

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

const appEnv = z.enum(["production", "staging"]);

/** A message from a form, as the emails show it. */
const formMessage = z.object({
  kind: z.enum(Constants.site.Enums.message_kind),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  message: z.string().nullable(),
  details: messageAnswers,
});

/** What email_details() returns for a form alert: the whole message. */
const messageDetails = formMessage.extend({ env: appEnv });

/** What email_details() returns for the daily digest: up to 20 messages, and how many in all. */
const digestDetails = z.object({
  env: appEnv,
  total: z.number().int().positive(),
  messages: z.array(formMessage.extend({ id: z.string(), created_at: z.string() })).min(1),
});

type Addressed = QueuedEmail & { subject: string };

/** An email's body, and where a reply goes when it isn't the sender. */
type Written = { body: ReactElement; replyTo?: string };

/** Each template the drain writes. Null means the details didn't fit it. */
const TEMPLATES: Record<string, (email: Addressed, details: unknown, links: DrainLinks) => Written | null> = {
  "request-submitted": (email, details, { financesUrl }) => {
    const parsed = requestDetails.safeParse(details);
    if (!email.related_id || !parsed.success || !parsed.data.payee) return null;
    const { amount_cents, vendor, description, by, payee, by_payee } = parsed.data;
    const body = requestSubmittedEmail({
      subject: email.subject,
      amountCents: amount_cents,
      vendor,
      description,
      by,
      byPayee: by_payee === true,
      payee,
      url: `${financesUrl}/admin/requests/${email.related_id}`,
    });
    return { body };
  },
  "request-returned": (email, details, { financesUrl }) => {
    const parsed = requestDetails.safeParse(details);
    if (!email.related_id || !parsed.success) return null;
    const { amount_cents, vendor, by, note } = parsed.data;
    const body = requestReturnedEmail({
      subject: email.subject,
      amountCents: amount_cents,
      vendor,
      by,
      note,
      url: `${financesUrl}/my/${email.related_id}`,
    });
    return { body };
  },
  "request-paid": (email, details, { financesUrl }) => {
    const parsed = requestDetails.safeParse(details);
    if (!email.related_id || !parsed.success) return null;
    const { amount_cents, vendor, payment_method, paid_at } = parsed.data;
    const body = requestPaidEmail({
      subject: email.subject,
      amountCents: amount_cents,
      vendor,
      paymentMethod: payment_method,
      paidAt: paid_at,
      url: `${financesUrl}/my/${email.related_id}`,
    });
    return { body };
  },
  "owner-changed": (email, details, { portalUrl }) => {
    const parsed = ownerDetails.safeParse(details);
    if (!email.related_id || !parsed.success) return null;
    const body = ownerChangedEmail({
      subject: email.subject,
      by: parsed.data.by,
      at: email.created_at,
      url: `${portalUrl}/people`,
    });
    return { body };
  },
  // Its subject carries the month's count, so it needs no details.
  "quota-warning": (email, _details, { portalUrl }) => ({
    body: quotaWarningEmail({ subject: email.subject, url: `${portalUrl}/email` }),
  }),
  "form-alert": (email, details, { portalUrl }) => {
    const parsed = messageDetails.safeParse(details);
    if (!email.related_id || !parsed.success) return null;
    const { kind, name, email: from, phone, message, details: answers, env } = parsed.data;
    const staging = env === "staging";
    const body = formAlertEmail({
      subject: email.subject,
      kind,
      name,
      email: from,
      phone,
      message,
      answers: answersOf(answers),
      at: email.created_at,
      staging,
      url: `${portalUrl}/messages/${email.related_id}`,
    });
    // On staging nobody else may hear about a test, so a reply can't reach them.
    return from && !staging ? { body, replyTo: from } : { body };
  },
  // It's from several people at once, so there's no Reply-To. Each one is written back to on their own.
  "daily-digest": (email, details, { portalUrl }) => {
    const parsed = digestDetails.safeParse(details);
    if (!parsed.success) return null;
    const { env, total, messages } = parsed.data;
    const body = dailyDigestEmail({
      subject: email.subject,
      total,
      messages: messages.map((shown) => ({
        kind: shown.kind,
        name: shown.name,
        email: shown.email,
        phone: shown.phone,
        message: shown.message,
        answers: answersOf(shown.details),
        at: shown.created_at,
        url: `${portalUrl}/messages/${shown.id}`,
      })),
      staging: env === "staging",
      url: `${portalUrl}/messages`,
    });
    return { body };
  },
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type Built = Written & { to: string; subject: string };

/** Writes one queued email, or says why it can't. */
async function build(email: QueuedEmail, deps: DrainDeps): Promise<Built | { problem: string }> {
  if (!Object.hasOwn(TEMPLATES, email.template)) {
    return { problem: `the drain doesn't write ${email.template} emails` };
  }
  const { to_address: to, subject } = email;
  if (!to || !subject) return { problem: "its details are missing" };
  const details = await deps.details(email.id);
  const written = TEMPLATES[email.template]({ ...email, subject }, details, deps.links);
  return written ? { to, subject, ...written } : { problem: "its details are missing" };
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
 *
 * With `digest`, it first asks the database to queue the daily digest, so
 * the digest goes out with everything else. A digest that can't be queued
 * never stops the drain, and its messages wait for tomorrow's.
 */
export async function drainEmails(
  deps: DrainDeps = defaultDrainDeps(),
  { digest = false }: { digest?: boolean } = {},
): Promise<DrainResult> {
  const { env } = deps;
  if (!env.sending) return { status: "off" };
  const { from } = env.sending;
  const started = deps.now();
  const result = { status: "drained" as const, sent: 0, failed: 0 };
  const listed = digest ? await queueDigest(deps) : null;
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
        ...(built.replyTo && { replyTo: built.replyTo }),
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
  return listed === null ? result : { ...result, digest: listed };
}

/** Where the forms' inbox comes from, for when it's missing. */
const NO_INBOX = {
  production: "Set YOUTH_INBOX_EMAIL so form messages reach the youth inbox.",
  staging: "Set OWNER_ALERT_EMAIL so staging's form messages reach the owner.",
} as const;

/** Queues the daily digest, or reports why not and returns 0. */
async function queueDigest(deps: DrainDeps): Promise<number> {
  try {
    const to = deps.digestTo();
    if (!to) {
      // Form alerts skip it too, so this is the one place a missing inbox shows.
      deps.report("Daily digest", new Error(NO_INBOX[deps.env.appEnv]));
      return 0;
    }
    return await deps.queueDigest(deps.env.appEnv, to);
  } catch (error) {
    deps.report("Daily digest", error);
    return 0;
  }
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
 * what the database already queued. The morning's poke adds `?digest=1`.
 */
export async function handleDrainRequest(
  request: Request,
  {
    secret,
    drain,
    report = (error) => reportError("Email drain", error),
  }: {
    secret: string | null;
    drain: (options: { digest: boolean }) => Promise<DrainResult>;
    report?: (error: unknown) => void;
  },
): Promise<Response> {
  if (!secret) return text(503, "The email drain isn't set up.");

  const bearer = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "");
  if (!bearer || !sameSecret(bearer[1], secret)) return text(401, "Wrong secret.");

  try {
    const digest = new URL(request.url).searchParams.get("digest") === "1";
    return Response.json(await drain({ digest }));
  } catch (error) {
    report(error);
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
    queueDigest: queueMessageDigest,
    // Read only when the digest is asked for, so a missing form setting can't break an ordinary poke.
    digestTo: () => readFormEnv().alertTo,
    report: reportError,
  };
}

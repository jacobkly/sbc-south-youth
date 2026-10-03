import "server-only";
import type { ReactElement } from "react";
import { Resend } from "resend";
import type { Database } from "@/lib/database.types";
import { readEmailEnv, type EmailEnv } from "@/lib/env";
import { emailMark, emailReserve, type EmailMark, type EmailReserve } from "@/lib/supabase/admin";
import { sendToLocalInbox } from "./local-inbox";
import { renderEmail, type RenderedEmail } from "./render";

/**
 * Which emails go first when the free tier runs short. Lower is more
 * important, and email_reserve() gives each level its own daily ceiling.
 */
export const EMAIL_PRIORITY = { signIn: 1, invite: 2, finance: 3, formAlert: 4, digest: 5 } as const;

export type EmailMessage = {
  /** Names the template in the log, like `invite`. Lowercase letters, numbers and dashes. */
  template: string;
  priority: (typeof EMAIL_PRIORITY)[keyof typeof EMAIL_PRIORITY];
  to: string;
  subject: string;
  scope: EmailReserve["scope"];
  /** The row the email is about, so the log can link to it. */
  related?: { type: string; id: string };
  body: ReactElement;
};

export type ReserveInput = EmailReserve;

export type OutgoingEmail = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  /** The log row's ID, so a retry can never send the same email twice. */
  idempotencyKey: string;
  tags: { name: string; value: string }[];
};

/** Everything sendEmail() talks to, so tests can swap in fakes. */
export type EmailDeps = {
  env: EmailEnv;
  reserve: (input: ReserveInput) => Promise<{ id: string; status: Database["public"]["Enums"]["email_status"] }>;
  send: (email: OutgoingEmail) => Promise<{ id: string } | { error: string }>;
  mark: (input: EmailMark) => Promise<void>;
  render: (body: ReactElement) => Promise<RenderedEmail>;
};

export type SendResult =
  | { status: "sent"; logId: string }
  /** Held back to save the free tier, or the address bounced or complained before. */
  | { status: "skipped_quota" | "suppressed"; logId: string }
  | { status: "failed"; logId: string | null; error: string }
  /** Email isn't set up here, so nothing was logged or sent. */
  | { status: "off" };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Sends one email right away: logs it (which checks the quota and the
 * suppression list), builds it, sends it through Resend, and records the
 * result. It never throws, so a failed email can't undo the action that
 * sent it. On staging every email goes to the owner alert address instead,
 * and the log records that address, so a test bounce never blocks a real one.
 */
export async function sendEmail(message: EmailMessage, deps: EmailDeps = defaultEmailDeps()): Promise<SendResult> {
  const { env } = deps;
  const staging = env.appEnv === "staging";
  const to = staging ? env.ownerAlertEmail : message.to;
  if (!env.sending || to === null) return { status: "off" };

  const subject = staging
    ? `[Staging for ${message.to.trim().toLowerCase()}] ${message.subject}`
    : message.subject;

  let logId: string;
  try {
    const reserved = await deps.reserve({
      template: message.template,
      priority: message.priority,
      to,
      subject,
      scope: message.scope,
      env: env.appEnv,
      relatedType: message.related?.type,
      relatedId: message.related?.id,
    });
    logId = reserved.id;
    if (reserved.status === "skipped_quota" || reserved.status === "suppressed") {
      return { status: reserved.status, logId };
    }
    if (reserved.status !== "sending") {
      throw new Error(`The email log answered ${reserved.status} instead of sending`);
    }
  } catch (error) {
    console.error(`[email] Couldn't log the ${message.template} email`, error);
    return { status: "failed", logId: null, error: messageOf(error) };
  }

  const fail = async (error: string): Promise<SendResult> => {
    console.error(`[email] The ${message.template} email failed: ${error}`);
    try {
      await deps.mark({ id: logId, status: "failed", error });
    } catch (markError) {
      // The row stays `sending`, and the outbox drain gives up on it later.
      console.error("[email] Couldn't mark the email failed", markError);
    }
    return { status: "failed", logId, error };
  };

  let rendered: RenderedEmail;
  try {
    rendered = await deps.render(message.body);
  } catch (error) {
    return fail(`Couldn't build the email: ${messageOf(error)}`);
  }

  let sent: Awaited<ReturnType<EmailDeps["send"]>>;
  try {
    sent = await deps.send({
      from: env.sending.from,
      to,
      subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: logId,
      tags: [
        { name: "log_id", value: logId },
        { name: "template", value: message.template },
      ],
    });
  } catch (error) {
    return fail(messageOf(error));
  }
  if ("error" in sent) return fail(sent.error);

  try {
    await deps.mark({ id: logId, status: "sent", resendId: sent.id });
  } catch (error) {
    // It went out. Resend's `email.sent` webhook carries the log tag and fills in the rest.
    console.error("[email] Sent, but couldn't mark the email sent", error);
  }
  return { status: "sent", logId };
}

/** Hands one email to Resend, or to the local inbox in development. */
export async function deliverEmail(
  sending: NonNullable<EmailEnv["sending"]>,
  { idempotencyKey, ...email }: OutgoingEmail,
): Promise<{ id: string } | { error: string }> {
  if ("localInbox" in sending) return sendToLocalInbox(sending.localInbox, email);
  const resend = new Resend(sending.apiKey);
  const { data, error } = await resend.emails.send(email, { idempotencyKey });
  if (error) return { error: `${error.name}: ${error.message}` };
  return { id: data.id };
}

/**
 * The real database and Resend (or the local inbox in development), read
 * fresh each call so a missing setting only turns email off.
 */
function defaultEmailDeps(): EmailDeps {
  const env = readEmailEnv();
  const sending = env.sending;
  return {
    env,
    reserve: emailReserve,
    mark: emailMark,
    render: renderEmail,
    send: async (email) => (sending ? deliverEmail(sending, email) : { error: "Email isn't set up" }),
  };
}

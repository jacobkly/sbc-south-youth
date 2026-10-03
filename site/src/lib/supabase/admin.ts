import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { EventRow, PostRow } from "@/lib/content/rows";
import type { Database, Json } from "@/lib/database.types";
import type { Message } from "@/lib/forms/schemas";

/**
 * The Supabase secret key, for the site's server only. It may call only
 * functions that service_role alone can execute, and it can't read any
 * table, so each export here is one named function. Nothing hands out the
 * client itself, so no caller can reach `.from()` or a different `.rpc()`.
 * The only Auth admin calls are for people an owner manages: creating an
 * invited account, and banning or unbanning one whose access changes.
 */

type EmailStatus = Database["public"]["Enums"]["email_status"];

let client: SupabaseClient<Database> | undefined;

function admin(): SupabaseClient<Database> {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Copy .env.example to .env.local and fill them in.",
    );
  }
  if (key.startsWith("sb_publishable_")) {
    throw new Error("SUPABASE_SECRET_KEY is the publishable key. Use the secret key (sb_secret_...).");
  }
  // No session of its own and never a user's cookies: every call acts as service_role.
  client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    // Never Next's fetch cache, which outlives deploys. The content loaders
    // cache their reads under tags a portal change can refresh, and every
    // other call here changes something.
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  return client;
}

/** A Postgres error as an Error, keeping its message for the email log. */
function failure(action: string, error: { message: string; code?: string }): Error {
  return new Error(`${action}: ${error.message}${error.code ? ` (${error.code})` : ""}`);
}

/** The events the public site shows: published and cancelled ones, past and future, soonest first. */
export async function publicEvents(): Promise<EventRow[]> {
  const { data, error } = await admin().schema("site").rpc("public_events");
  if (error) throw failure("Couldn't read the events", error);
  return data;
}

/** The heads-ups showing right now, pinned first, then newest. */
export async function publicPosts(): Promise<PostRow[]> {
  const { data, error } = await admin().schema("site").rpc("public_posts");
  if (error) throw failure("Couldn't read the heads-ups", error);
  return data;
}

export type MessageSave = {
  kind: Database["site"]["Enums"]["message_kind"];
  /** The form's checked fields. The database checks them again and keeps only the ones each kind takes. */
  payload: Omit<Message, "kind" | "reason">;
  /** The sender's address, salted and hashed, for the hourly limit. */
  ipHash: string;
  env: "production" | "staging";
  /** Where to queue the alert. Null queues none. */
  alertTo: string | null;
};

export type MessageSaved = { status: "saved"; id: string } | { status: "limited"; message: string };

/**
 * Saves a message from a public form and queues its alert. The database
 * checks the fields again and allows each sender 5 messages an hour, and
 * the 6th comes back `limited` with a message to show them.
 */
export async function saveMessage(input: MessageSave): Promise<MessageSaved> {
  const { data, error } = await admin()
    .schema("site")
    .rpc("submit_message", {
      p_kind: input.kind,
      p_payload: input.payload,
      p_ip_hash: input.ipHash,
      p_env: input.env,
      p_alert_to: input.alertTo ?? undefined,
    });
  if (error?.code === "PT429") return { status: "limited", message: error.message };
  if (error) throw failure("Couldn't save the message", error);
  return { status: "saved", id: data };
}

export type EmailReserve = {
  template: string;
  priority: number;
  to: string;
  subject: string;
  scope: "site" | "finances" | "platform";
  env: "production" | "staging";
  relatedType?: string;
  relatedId?: string;
};

/**
 * Checks the quota and logs an email that's about to be sent right away. It
 * comes back `sending` when it may go out, or `skipped_quota` or `suppressed`.
 */
export async function emailReserve(input: EmailReserve): Promise<{ id: string; status: EmailStatus }> {
  // It returns one row, not a set, so PostgREST answers with the object itself.
  const { data, error } = await admin().rpc("email_reserve", {
    p_template: input.template,
    p_priority: input.priority,
    p_to: input.to,
    p_subject: input.subject,
    p_scope: input.scope,
    p_env: input.env,
    p_related_type: input.relatedType,
    p_related_id: input.relatedId,
    p_send_now: true,
  });
  if (error) throw failure("Couldn't log the email", error);
  return { id: data.id, status: data.status };
}

export type EmailMark =
  | { id: string; status: "sent"; resendId: string }
  | { id: string; status: "failed"; error: string };

/** Records what Resend said about a send. */
export async function emailMark(input: EmailMark): Promise<void> {
  const { error } = await admin().rpc("email_mark", {
    p_id: input.id,
    p_status: input.status,
    ...(input.status === "sent" ? { p_resend_id: input.resendId } : { p_error: input.error }),
  });
  if (error) throw failure("Couldn't mark the email", error);
}

export type ClaimedEmail = Pick<
  Database["public"]["Tables"]["email_log"]["Row"],
  "id" | "template" | "to_address" | "subject" | "related_type" | "related_id" | "resend_id" | "created_at"
>;

/**
 * Hands the drain up to `limit` queued emails for one environment and marks
 * them sending, so a drain running at the same time never gets the same ones.
 */
export async function emailClaim(env: "production" | "staging", limit: number): Promise<ClaimedEmail[]> {
  const { data, error } = await admin().rpc("email_claim", { p_env: env, p_limit: limit });
  if (error) throw failure("Couldn't claim queued emails", error);
  return data.map(({ id, template, to_address, subject, related_type, related_id, resend_id, created_at }) => ({
    id,
    template,
    to_address,
    subject,
    related_type,
    related_id,
    resend_id,
    created_at,
  }));
}

/**
 * Queues the daily digest of open messages whose alerts never went, and
 * returns how many it lists. 0 means none were waiting, or the quota or the
 * once-a-day rule skipped it. The database keeps any message out of two.
 */
export async function queueMessageDigest(env: "production" | "staging", to: string): Promise<number> {
  const { data, error } = await admin().schema("site").rpc("queue_message_digest", { p_env: env, p_to: to });
  if (error) throw failure("Couldn't queue the digest", error);
  return data;
}

/** What a queued email shows, read only while the drain is sending it. Null when there's nothing to show. */
export async function emailDetails(id: string): Promise<Json> {
  const { data, error } = await admin().rpc("email_details", { p_log_id: id });
  if (error) throw failure("Couldn't read the email's details", error);
  return data;
}

export type EmailWebhookEvent = {
  resendId: string;
  status: Extract<EmailStatus, "sent" | "delivered" | "failed" | "bounced" | "complained">;
  logId: string | null;
  to: string | null;
  subject: string | null;
  error: string | null;
  at: string | null;
};

/** Records a delivery event from Resend's webhook. */
export async function emailRecordWebhook(event: EmailWebhookEvent): Promise<void> {
  const { error } = await admin().rpc("email_record_webhook", {
    p_resend_id: event.resendId,
    p_status: event.status,
    p_log_id: event.logId ?? undefined,
    p_to: event.to ?? undefined,
    p_subject: event.subject ?? undefined,
    p_error: event.error ?? undefined,
    p_at: event.at ?? undefined,
  });
  if (error) throw failure("Couldn't record the webhook", error);
}

export type InvitedUser = { email: string; fullName: string };

/**
 * Creates the account for someone an owner is inviting, with no password
 * and the email already confirmed: setup emails them a code before they can
 * pick a password, which proves the address. handle_new_user() makes their
 * users row, with no roles. Call it only from a server action that has
 * already checked the caller is an owner.
 */
export async function createInvitedUser(input: InvitedUser): Promise<{ id: string }> {
  const { data, error } = await admin().auth.admin.createUser({
    email: input.email,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });
  if (error) throw failure("Couldn't create the account", { message: error.message, code: error.code });
  return { id: data.user.id };
}

/** Long enough to mean "until an owner reinstates them". */
const BANNED = "876000h";

/**
 * Stops someone whose access was removed from staying signed in: their
 * sign-in can't be refreshed, and they can't sign in again. Their access
 * token works until it expires, but RLS already gives it nothing. Call it
 * only from a server action that has already checked the caller is an
 * owner, after remove_access() succeeded.
 */
export async function banUser(userId: string): Promise<void> {
  const { error } = await admin().auth.admin.updateUserById(userId, { ban_duration: BANNED });
  if (error) throw failure("Couldn't sign them out", { message: error.message, code: error.code });
}

/** Lets a reinstated person sign in again. Same rules as banUser(). */
export async function unbanUser(userId: string): Promise<void> {
  const { error } = await admin().auth.admin.updateUserById(userId, { ban_duration: "none" });
  if (error) throw failure("Couldn't let them sign in", { message: error.message, code: error.code });
}

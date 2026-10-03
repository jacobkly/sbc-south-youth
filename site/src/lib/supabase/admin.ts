import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * The Supabase secret key, for the site's server only. It may call only
 * functions that service_role alone can execute, and it can't read any
 * table, so each export here is one named function. Nothing hands out the
 * client itself, so no caller can reach `.from()` or a different `.rpc()`.
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
  });
  return client;
}

/** A Postgres error as an Error, keeping its message for the email log. */
function failure(action: string, error: { message: string; code?: string }): Error {
  return new Error(`${action}: ${error.message}${error.code ? ` (${error.code})` : ""}`);
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

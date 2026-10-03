import "server-only";
import { createClient } from "@/lib/supabase/server";
import { emailOverview, parseEmailSummary, type EmailOverview } from "./summary";

/**
 * What the Email screen reads, as the signed-in person. email_summary()
 * checks for an owner, and RLS lets only owners read the log and the
 * blocked addresses, so anyone else gets an error or nothing.
 */

/** Enough to spot a pattern. Older ones are in the counts. */
const PROBLEM_LIMIT = 10;

export type EmailProblem = {
  id: string;
  template: string;
  status: "failed" | "bounced" | "complained";
  /** Cleared after 90 days, and missing for an email that never had one. */
  toAddress: string | null;
  error: string | null;
  env: "production" | "staging";
  createdAt: string;
};

export type Suppression = {
  id: string;
  address: string;
  reason: "bounced" | "complained";
  createdAt: string;
};

/** How full both limits are and the last 31 days by template. */
export async function loadEmailOverview(): Promise<EmailOverview> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("email_summary");
  if (error) throw error;
  return emailOverview(parseEmailSummary(data));
}

/** The newest emails from the last 31 days that failed, bounced or were marked as spam. */
export async function loadEmailProblems(): Promise<EmailProblem[]> {
  const since = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_log")
    .select("id, template, status, to_address, error, env, created_at")
    .in("status", ["failed", "bounced", "complained"])
    .gt("created_at", since)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PROBLEM_LIMIT);
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    template: row.template,
    status: row.status as EmailProblem["status"],
    toAddress: row.to_address,
    error: row.error,
    env: row.env === "staging" ? "staging" : "production",
    createdAt: row.created_at,
  }));
}

/** Addresses nothing more is sent to, newest first. */
export async function loadSuppressions(): Promise<Suppression[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_suppressions")
    .select("id, address, reason, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    address: row.address,
    reason: row.reason === "complained" ? "complained" : "bounced",
    createdAt: row.created_at,
  }));
}

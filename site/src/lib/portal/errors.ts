import "server-only";
import { reportError } from "@/lib/errors/report";
import { friendlyError } from "@/lib/portal/people/invite";
import { createClient } from "@/lib/supabase/server";

/**
 * Portal errors for the owners' error log, with who hit them. A refusal
 * the database explains, like a missing description, isn't an error, so
 * only what the person couldn't fix gets logged.
 */

export type Report = (source: string, error: unknown) => Promise<void>;

/** Logs an error with the signed-in person's ID, or none when there's no session. */
export async function reportPortalError(source: string, error: unknown): Promise<void> {
  let userId: string | null = null;
  try {
    const { data } = await (await createClient()).auth.getClaims();
    userId = data?.claims.sub ?? null;
  } catch {
    // Who hit it is a nice-to-have. The error still gets logged.
  }
  reportError(source, error, { userId });
}

/**
 * What to tell the person when an action's database call fails: the
 * database's own words for a refused change, or the fallback. Only the
 * fallback means something broke, so only then is it logged.
 */
export async function actionError(
  source: string,
  error: { code?: string; message: string } | null,
  fallback: string,
  report: Report = reportPortalError,
): Promise<string> {
  const shown = friendlyError(error, fallback);
  if (error && shown === fallback) await report(source, error);
  return shown;
}

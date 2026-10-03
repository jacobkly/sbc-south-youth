import "server-only";
import { after } from "next/server";
import { readPortalEnv, type AppEnv } from "@/lib/env";
import { reportAppError } from "@/lib/supabase/admin";
import { errorRecord, isControlFlow } from "./record";

/**
 * The owners' error log. Vercel's free plan keeps runtime logs for only a
 * short time, so unexpected server errors also go to app_errors, where
 * owners see them on Home for 30 days. Only owners can read it, so the
 * message never reaches anyone else.
 */

export type ReportOptions = { userId?: string | null };

/** Production unless the settings say staging. A bad setting never stops a report. */
function appEnv(): AppEnv {
  try {
    return readPortalEnv().appEnv;
  } catch {
    return "production";
  }
}

/**
 * Writes an error to the host's log and the owners' error log, and waits
 * for the write. It never throws, so the caller still handles the error
 * it's reporting.
 */
export async function recordError(
  source: string,
  error: unknown,
  { userId = null }: ReportOptions = {},
): Promise<void> {
  if (isControlFlow(error)) return;
  console.error(`[error] ${source}`, error);
  try {
    await reportAppError({ ...errorRecord(source, error), userId, env: appEnv() });
  } catch (failure) {
    console.error("[error] Couldn't write to the error log", failure);
  }
}

/**
 * Reports an error once the response has gone, so nobody waits on the
 * write. Outside a request, it writes straight away.
 */
export function reportError(source: string, error: unknown, options?: ReportOptions): void {
  const write = () => recordError(source, error, options);
  try {
    after(write);
  } catch {
    void write();
  }
}

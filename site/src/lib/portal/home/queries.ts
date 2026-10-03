import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseBackupReport, type BackupReport } from "./backup";
import { errorsOverview, errorsSince, READ_ERRORS, type ErrorsOverview } from "./errors";
import { parseStorageSummary, storageOverview, type StorageOverview } from "./storage";

/** How full the free plan's file storage and database are, as the signed-in person. */
export async function loadStorage(): Promise<StorageOverview> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("storage_summary");
  if (error) throw error;
  return storageOverview(parseStorageSummary(data));
}

/** The newest backup the nightly job reported, or null before the first. Only owners can read these rows. */
export async function loadLastBackup(): Promise<BackupReport | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_log")
    .select("created_at, changes")
    .eq("action", "backup.completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? parseBackupReport(data) : null;
}

/** The newest errors from the last 30 days, with who hit them. Only owners can read these rows. */
export async function loadErrors(now: Date = new Date()): Promise<ErrorsOverview> {
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("app_errors")
    .select("id, source, message, code, env, created_at, user:users(full_name)", { count: "exact" })
    .gte("created_at", errorsSince(now))
    .order("created_at", { ascending: false })
    .limit(READ_ERRORS);
  if (error) throw error;
  return errorsOverview(data, count, now);
}

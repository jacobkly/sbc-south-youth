import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseBackupReport, type BackupReport } from "./backup";
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

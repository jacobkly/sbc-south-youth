import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseStorageSummary, storageOverview, type StorageOverview } from "./storage";

/** How full the free plan's file storage and database are, as the signed-in person. */
export async function loadStorage(): Promise<StorageOverview> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("storage_summary");
  if (error) throw error;
  return storageOverview(parseStorageSummary(data));
}

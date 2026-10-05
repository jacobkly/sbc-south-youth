import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { YouthEntry } from "./stats";

export const YOUTH_ENTRY_COLUMNS = "id, kind, received_on, amount_cents, method, event_name";

/** Every youth entry, newest first. Throws on failure. */
export function loadYouthEntries(supabase: SupabaseClient<Database>): Promise<YouthEntry[]> {
  return fetchAll((from, to) =>
    supabase
      .from("youth_income")
      .select(YOUTH_ENTRY_COLUMNS)
      .order("received_on", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to),
  );
}

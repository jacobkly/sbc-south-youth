import type { SupabaseClient } from "@supabase/supabase-js";
import type { IsoDate } from "@/lib/dates";
import type { Database } from "@/lib/database.types";
import { REPORT_STATUSES } from "@/lib/reports/filters";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { CafeCost, CafeWeek } from "./cafe";
import type { YouthEntry } from "./stats";

export const YOUTH_ENTRY_COLUMNS = "id, kind, received_on, amount_cents, method, event_name";

export const CAFE_WEEK_COLUMNS = "id, week_ending, sales_cents, note";

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

/** Every cafe week, newest first. Throws on failure. */
export function loadCafeWeeks(supabase: SupabaseClient<Database>): Promise<CafeWeek[]> {
  return fetchAll((from, to) =>
    supabase.from("cafe_weeks").select(CAFE_WEEK_COLUMNS).order("week_ending", { ascending: false }).range(from, to),
  );
}

/**
 * The cafe requests bought on or after `from` that Reports counts, approved
 * and paid, for profit. Throws on failure.
 */
export function loadCafeCosts(supabase: SupabaseClient<Database>, from: IsoDate): Promise<CafeCost[]> {
  return fetchAll((start, end) =>
    supabase
      .from("request_report")
      .select("purchase_date, amount_cents")
      .eq("type", "cafe")
      .in("status", [...REPORT_STATUSES])
      .gte("purchase_date", from)
      .order("id")
      .range(start, end),
  );
}

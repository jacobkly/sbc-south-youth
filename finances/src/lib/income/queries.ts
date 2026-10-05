import type { SupabaseClient } from "@supabase/supabase-js";
import type { DateRange, IsoDate } from "@/lib/dates";
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
 * The youth entries and cafe weeks that count in a range, oldest first: an
 * entry by the day it came in, and a week by the Sunday it ends. Throws on
 * failure.
 */
export async function loadIncomeIn(
  supabase: SupabaseClient<Database>,
  { start, end }: DateRange,
): Promise<{ youth: YouthEntry[]; weeks: CafeWeek[] }> {
  const [youth, weeks] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("youth_income")
        .select(YOUTH_ENTRY_COLUMNS)
        .gte("received_on", start)
        .lte("received_on", end)
        .order("received_on")
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("cafe_weeks")
        .select(CAFE_WEEK_COLUMNS)
        .gte("week_ending", start)
        .lte("week_ending", end)
        .order("week_ending")
        .range(from, to),
    ),
  ]);
  return { youth, weeks };
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

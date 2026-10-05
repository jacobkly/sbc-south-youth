import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { CAFE_WEEK_COLUMNS, YOUTH_ENTRY_COLUMNS } from "@/lib/income/queries";
import { ACTIVITY_KIND_ACTIONS, ACTIVITY_PAGE_SIZE, MAX_ACTIVITY_PAGES, type ActivityFilters, type EventKind } from "./feed";
import { currentSubjects, INCOME_ENTITY_TYPES, takeNewest, type IncomeChange } from "./income";

const ACTIVITY_COLUMNS = `
  id, request_id, actor_id, action, from_status, note, changes, created_at,
  actor:users(full_name),
  request:reimbursement_requests(id, request_number, type, amount_cents, vendor, description, payee:payees(full_name))
`;

const INCOME_CHANGE_COLUMNS = "id, actor_id, action, entity_type, entity_id, changes, created_at, actor:users(full_name)";

async function loadRequestEvents(supabase: SupabaseClient<Database>, kind: EventKind | "all", shown: number) {
  let query = supabase.from("request_events").select(ACTIVITY_COLUMNS);
  if (kind !== "all") query = query.in("action", ACTIVITY_KIND_ACTIONS[kind]);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(0, shown);
  if (error) throw error;
  return data;
}

async function loadIncomeChanges(supabase: SupabaseClient<Database>, shown: number) {
  const { data, error } = await supabase
    .from("activity_log")
    .select(INCOME_CHANGE_COLUMNS)
    .eq("scope", "finances")
    .in("entity_type", INCOME_ENTITY_TYPES)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(0, shown);
  if (error) throw error;
  return data;
}

/**
 * Every request event and income change the loaded pages hold, each newest
 * first. The request kinds show only request events, Income only income
 * changes, and All both. Throws if a query fails.
 */
export async function loadActivity(supabase: SupabaseClient<Database>, filters: ActivityFilters) {
  const shown = filters.pages * ACTIVITY_PAGE_SIZE;
  const { kind } = filters;
  // Each loads one more than is shown, to know whether there are more.
  // Supabase returns at most 1,000, so on the last page the extra one
  // doesn't come back.
  const [requestEvents, incomeChanges] = await Promise.all([
    kind === "income" ? [] : loadRequestEvents(supabase, kind, shown),
    kind === "all" || kind === "income" ? loadIncomeChanges(supabase, shown) : [],
  ]);
  const { a: events, b: income, more } = takeNewest(requestEvents, incomeChanges, shown);
  return {
    events,
    income,
    hasMore: more && filters.pages < MAX_ACTIVITY_PAGES,
    /** There may be older activity than the most the page loads. */
    capped: filters.pages >= MAX_ACTIVITY_PAGES && events.length + income.length >= shown,
  };
}

/** An event as the activity page shows it. */
export type ActivityEvent = Awaited<ReturnType<typeof loadActivity>>["events"][number];

/** An income change as the activity page shows it. */
export type IncomeActivity = Awaited<ReturnType<typeof loadActivity>>["income"][number];

/** Enough ids per query to keep the URL short. */
const LOOKUP_CHUNK = 100;

function chunks<T>(items: readonly T[]): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += LOOKUP_CHUNK) result.push(items.slice(start, start + LOOKUP_CHUNK));
  return result;
}

/** The entries these changes are about that are still there, by id. Throws if a query fails. */
export async function loadCurrentIncome(supabase: SupabaseClient<Database>, changes: readonly IncomeChange[]) {
  const idsOf = (type: string) => [
    ...new Set(changes.flatMap((change) => (change.entity_type === type && change.entity_id ? [change.entity_id] : []))),
  ];
  const [entries, weeks] = await Promise.all([
    Promise.all(
      chunks(idsOf("youth_income")).map(async (ids) => {
        const { data, error } = await supabase.from("youth_income").select(YOUTH_ENTRY_COLUMNS).in("id", ids);
        if (error) throw error;
        return data;
      }),
    ),
    Promise.all(
      chunks(idsOf("cafe_week")).map(async (ids) => {
        const { data, error } = await supabase.from("cafe_weeks").select(CAFE_WEEK_COLUMNS).in("id", ids);
        if (error) throw error;
        return data;
      }),
    ),
  ]);
  return currentSubjects(entries.flat(), weeks.flat());
}

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { laDateOf, laMidnight, type IsoDate } from "@/lib/dates";
import { CAFE_WEEK_COLUMNS, YOUTH_ENTRY_COLUMNS } from "@/lib/income/queries";
import {
  ACTIVITY_KIND_ACTIONS,
  firstSince,
  MAX_ACTIVITY_EVENTS,
  olderSince,
  type ActivityFilters,
  type ActivityKind,
  type EventKind,
} from "./feed";
import { currentSubjects, INCOME_ENTITY_TYPES, takeNewest, type IncomeChange } from "./income";

const ACTIVITY_COLUMNS = `
  id, request_id, actor_id, action, from_status, note, changes, created_at,
  actor:users(full_name),
  request:reimbursement_requests(id, request_number, type, amount_cents, vendor, description, payee:payees(full_name))
`;

const INCOME_CHANGE_COLUMNS = "id, actor_id, action, entity_type, entity_id, changes, created_at, actor:users(full_name)";

/** Supabase returns at most this many rows a query. */
const ROWS_PER_QUERY = 1000;

/**
 * Up to `limit` rows of a newest-first query, a query's worth at a time.
 * Only an empty page means the end, since a short one might just be a
 * lower cap.
 */
async function loadUpTo<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  limit: number,
): Promise<T[]> {
  const rows: T[] = [];
  while (rows.length < limit) {
    const { data, error } = await page(rows.length, Math.min(rows.length + ROWS_PER_QUERY, limit) - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
  }
  return rows;
}

/** Request events from `start` on, newest first: the most the page shows, and one more. */
function loadRequestEvents(supabase: SupabaseClient<Database>, kind: EventKind | "all", start: string) {
  return loadUpTo((from, to) => {
    let query = supabase.from("request_events").select(ACTIVITY_COLUMNS).gte("created_at", start);
    if (kind !== "all") query = query.in("action", ACTIVITY_KIND_ACTIONS[kind]);
    return query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to);
  }, MAX_ACTIVITY_EVENTS + 1);
}

/** Income changes from `start` on, newest first: the most the page shows, and one more. */
function loadIncomeChanges(supabase: SupabaseClient<Database>, start: string) {
  return loadUpTo(
    (from, to) =>
      supabase
        .from("activity_log")
        .select(INCOME_CHANGE_COLUMNS)
        .eq("scope", "finances")
        .in("entity_type", INCOME_ENTITY_TYPES)
        .gte("created_at", start)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
    MAX_ACTIVITY_EVENTS + 1,
  );
}

/** When the newest request event before `start` happened, or null. */
async function requestEventBefore(supabase: SupabaseClient<Database>, kind: EventKind | "all", start: string) {
  let query = supabase.from("request_events").select("created_at").lt("created_at", start);
  if (kind !== "all") query = query.in("action", ACTIVITY_KIND_ACTIONS[kind]);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(1);
  if (error) throw error;
  return data[0]?.created_at ?? null;
}

/** When the newest income change before `start` happened, or null. */
async function incomeChangeBefore(supabase: SupabaseClient<Database>, start: string) {
  const { data, error } = await supabase
    .from("activity_log")
    .select("created_at")
    .eq("scope", "finances")
    .in("entity_type", INCOME_ENTITY_TYPES)
    .lt("created_at", start)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data[0]?.created_at ?? null;
}

/**
 * The kind's activity from the start of `since` in LA, newest first, and
 * the LA day of the newest activity before it, if any.
 */
async function loadSince(supabase: SupabaseClient<Database>, kind: ActivityKind, since: IsoDate) {
  const start = laMidnight(since).toISOString();
  const [events, income, requestBefore, incomeBefore] = await Promise.all([
    kind === "income" ? [] : loadRequestEvents(supabase, kind, start),
    kind === "all" || kind === "income" ? loadIncomeChanges(supabase, start) : [],
    kind === "income" ? null : requestEventBefore(supabase, kind, start),
    kind === "all" || kind === "income" ? incomeChangeBefore(supabase, start) : null,
  ]);
  const before = [requestBefore, incomeBefore].flatMap((at) => (at ? [laDateOf(at)] : [])).sort();
  return { since, events, income, olderOn: before.at(-1) ?? null };
}

/**
 * Every request event and income change from today back to the day the
 * filter has reached, each newest first. The request kinds show only
 * request events, Income only income changes, and All both. When nothing
 * happened in the past week, it starts at the newest activity instead, so
 * the page never opens empty while there's history. Throws if a query
 * fails.
 */
export async function loadActivity(supabase: SupabaseClient<Database>, filters: ActivityFilters, today: IsoDate) {
  const { kind } = filters;
  let loaded = await loadSince(supabase, kind, filters.since ?? firstSince(today));
  if (loaded.events.length + loaded.income.length === 0 && loaded.olderOn) {
    loaded = await loadSince(supabase, kind, olderSince(loaded.since, loaded.olderOn, today));
  }
  const { a: events, b: income, more } = takeNewest(loaded.events, loaded.income, MAX_ACTIVITY_EVENTS);
  return {
    events,
    income,
    /** Where "Load more" reaches back to, or null when there's nothing older to show. */
    older: !more && loaded.olderOn ? olderSince(loaded.since, loaded.olderOn, today) : null,
    /** There's more activity than the most the page loads, so the oldest is left out. */
    capped: more,
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

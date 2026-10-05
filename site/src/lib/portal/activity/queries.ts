import "server-only";
import { laDateOf, laMidnight, type IsoDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { FeedContext, FeedRequest, FeedRow } from "./feed";
import { toFeedRow } from "./feed";
import { firstSince, MAX_ACTIVITY_EVENTS, olderSince, type ActivityQuery } from "./filters";
import { currentIncome, incomeSubjects, type IncomeSubject } from "./income";
import { changedPayeeIds } from "./requests";

/**
 * What the Activity screen and its download read, as the signed-in person.
 * RLS decides which rows come back: finance rows only for finance viewers,
 * people and sign-ins only for owners. The filters only narrow that down.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Supabase returns at most this many rows a query. */
const MAX_ROWS = 1000;
/** IDs per `in` filter, so the URL stays short however many there are. */
const IDS_PER_QUERY = 100;

function feedQuery(supabase: Supabase, query: ActivityQuery) {
  let builder = supabase.from("activity_feed").select("*").in("scope", query.scopes);
  if (query.actions) builder = builder.in("action", query.actions);
  if (query.actorId) builder = builder.eq("actor_id", query.actorId);
  return builder.order("created_at", { ascending: false }).order("id", { ascending: false });
}

function feedRows(data: Parameters<typeof toFeedRow>[0][]): FeedRow[] {
  return data.map(toFeedRow).filter((row) => row !== null);
}

/**
 * Events from `start` on, newest first: the most the screen shows, and one
 * more. Only an empty page means the end, since a short one might just be
 * a lower cap.
 */
async function eventsFrom(supabase: Supabase, query: ActivityQuery, start: string) {
  const limit = MAX_ACTIVITY_EVENTS + 1;
  const rows: Parameters<typeof toFeedRow>[0][] = [];
  while (rows.length < limit) {
    const to = Math.min(rows.length + MAX_ROWS, limit) - 1;
    const { data, error } = await feedQuery(supabase, query).gte("created_at", start).range(rows.length, to);
    if (error) throw error;
    if (data.length === 0) break;
    rows.push(...data);
  }
  return rows;
}

/** The LA day of the newest event before `start`, or null. */
async function newestDayBefore(supabase: Supabase, query: ActivityQuery, start: string) {
  const { data, error } = await feedQuery(supabase, query).lt("created_at", start).limit(1);
  if (error) throw error;
  const at = data[0]?.created_at;
  return at ? laDateOf(at) : null;
}

/** The events from the start of `since` in LA, and the day of the newest one before it. */
async function loadSince(supabase: Supabase, query: ActivityQuery, since: IsoDate) {
  const start = laMidnight(since).toISOString();
  const [rows, olderOn] = await Promise.all([
    eventsFrom(supabase, query, start),
    newestDayBefore(supabase, query, start),
  ]);
  return { since, rows, olderOn };
}

/**
 * Every event from today back to the day the filters have reached, newest
 * first. When nothing happened in the past week, it starts at the newest
 * activity instead, so the screen never opens empty while there's history.
 * Throws if a query fails.
 */
export async function loadActivity(query: ActivityQuery, since: IsoDate | null, today: IsoDate) {
  const supabase = await createClient();
  let loaded = await loadSince(supabase, query, since ?? firstSince(today));
  if (loaded.rows.length === 0 && loaded.olderOn) {
    loaded = await loadSince(supabase, query, olderSince(loaded.since, loaded.olderOn, today));
  }
  const capped = loaded.rows.length > MAX_ACTIVITY_EVENTS;
  return {
    rows: feedRows(loaded.rows.slice(0, MAX_ACTIVITY_EVENTS)),
    /** Where "Load more" reaches back to, or null when there's nothing older to show. */
    older: !capped && loaded.olderOn ? olderSince(loaded.since, loaded.olderOn, today) : null,
    /** There's more activity than the most the screen loads, so the oldest is left out. */
    capped,
  };
}

/** Rows for a download, newest first: everything that matches, up to `limit`. */
export async function loadActivityForExport(query: ActivityQuery, limit: number) {
  const supabase = await createClient();
  const rows: FeedRow[] = [];
  for (let from = 0; from < limit; from += MAX_ROWS) {
    const to = Math.min(from + MAX_ROWS, limit) - 1;
    const { data, error } = await feedQuery(supabase, query).range(from, to);
    if (error) throw error;
    rows.push(...feedRows(data));
    if (data.length < to - from + 1) return { rows, capped: false };
  }
  return { rows, capped: true };
}

/** `ids` in groups small enough for one query each. */
function chunks<T>(ids: readonly T[]): T[][] {
  const groups: T[][] = [];
  for (let start = 0; start < ids.length; start += IDS_PER_QUERY) groups.push(ids.slice(start, start + IDS_PER_QUERY));
  return groups;
}

async function loadRequests(supabase: Supabase, ids: string[]): Promise<Map<string, FeedRequest>> {
  const results = await Promise.all(
    chunks(ids).map((group) =>
      supabase
        .from("reimbursement_requests")
        .select("id, request_number, type, amount_cents, vendor, description, payee:payees(full_name)")
        .in("id", group),
    ),
  );
  const requests = new Map<string, FeedRequest>();
  for (const { data, error } of results) {
    if (error) throw error;
    for (const { payee, ...request } of data) {
      requests.set(request.id, { ...request, payee_name: payee?.full_name ?? null });
    }
  }
  return requests;
}

async function loadPayeeNames(supabase: Supabase, ids: string[]): Promise<Map<string, string>> {
  const results = await Promise.all(
    chunks(ids).map((group) => supabase.from("payees").select("id, full_name").in("id", group)),
  );
  const names = new Map<string, string>();
  for (const { data, error } of results) {
    if (error) throw error;
    for (const payee of data) names.set(payee.id, payee.full_name);
  }
  return names;
}

async function loadInviteUsers(supabase: Supabase, ids: string[]): Promise<Map<string, string>> {
  const results = await Promise.all(
    chunks(ids).map((group) => supabase.from("invites").select("id, user_id").in("id", group)),
  );
  const users = new Map<string, string>();
  for (const { data, error } of results) {
    if (error) throw error;
    for (const invite of data) users.set(invite.id, invite.user_id);
  }
  return users;
}

/**
 * The tithes, event income, and cafe weeks the rows mention: each as it is
 * now, or as the log last recorded it once deleted.
 */
async function loadIncome(supabase: Supabase, rows: readonly FeedRow[]): Promise<Map<string, IncomeSubject>> {
  const [entries, weeks] = await Promise.all([
    Promise.all(
      chunks(entityIds(rows, (row) => row.entity_type === "youth_income")).map((group) =>
        supabase.from("youth_income").select("id, kind, received_on, amount_cents, method, event_name").in("id", group),
      ),
    ),
    Promise.all(
      chunks(entityIds(rows, (row) => row.entity_type === "cafe_week")).map((group) =>
        supabase.from("cafe_weeks").select("id, week_ending, sales_cents, note").in("id", group),
      ),
    ),
  ]);
  for (const { error } of [...entries, ...weeks]) if (error) throw error;
  return incomeSubjects(
    rows,
    currentIncome(
      entries.flatMap(({ data }) => data ?? []),
      weeks.flatMap(({ data }) => data ?? []),
    ),
  );
}

/** Everyone's name, for bylines, the person filter, and who an event is about. */
export async function loadPeopleNames(): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("people_directory");
  if (error) throw error;
  const names = new Map<string, string>();
  for (const person of data) if (person.full_name.trim()) names.set(person.id, person.full_name.trim());
  return names;
}

/** IDs of what the rows are about, of one kind. */
function entityIds(rows: readonly FeedRow[], test: (row: FeedRow) => boolean): string[] {
  return [...new Set(rows.filter(test).flatMap((row) => (row.entity_id ? [row.entity_id] : [])))];
}

/** The requests, payees, invites, and income the rows mention, for wording them. */
export async function loadFeedLookups(
  rows: readonly FeedRow[],
): Promise<Pick<FeedContext, "requests" | "payeeNames" | "inviteUsers" | "income">> {
  const supabase = await createClient();
  const isRequest = (row: FeedRow) => row.entity_type === "request";
  // Finances' wording takes the action without the feed's "request." prefix.
  const edits = rows.filter(isRequest).map((row) => ({ ...row, action: row.action.replace(/^request\./, "") }));
  const [requests, payeeNames, inviteUsers, income] = await Promise.all([
    loadRequests(supabase, entityIds(rows, isRequest)),
    loadPayeeNames(supabase, changedPayeeIds(edits)),
    loadInviteUsers(supabase, entityIds(rows, (row) => row.entity_type === "invite")),
    loadIncome(supabase, rows),
  ]);
  return { requests, payeeNames, inviteUsers, income };
}

/** Records that someone downloaded the feed. Throws if it can't, so nothing goes out unrecorded. */
export async function recordActivityExport(filename: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_event", { p_action: "activity.exported", p_entity_name: filename });
  if (error) throw error;
}

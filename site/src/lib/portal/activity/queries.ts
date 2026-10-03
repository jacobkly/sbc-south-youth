import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { FeedContext, FeedRequest, FeedRow } from "./feed";
import { toFeedRow } from "./feed";
import { ACTIVITY_PAGE_SIZE, MAX_ACTIVITY_PAGES, type ActivityQuery } from "./filters";
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

/** The newest events across the loaded pages. Throws if the query fails. */
export async function loadActivity(query: ActivityQuery, pages: number) {
  const supabase = await createClient();
  const shown = pages * ACTIVITY_PAGE_SIZE;
  // One more than is shown, to know whether there are more. On the last
  // page that's past what Supabase returns, so it doesn't come back.
  const { data, error } = await feedQuery(supabase, query).range(0, shown);
  if (error) throw error;
  const rows = feedRows(data.slice(0, shown));
  return {
    rows,
    hasMore: data.length > shown && pages < MAX_ACTIVITY_PAGES,
    /** There may be older events than the most the screen loads. */
    capped: pages >= MAX_ACTIVITY_PAGES && data.length >= shown,
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

/** The requests, payees, and invites the rows mention, for wording them. */
export async function loadFeedLookups(
  rows: readonly FeedRow[],
): Promise<Pick<FeedContext, "requests" | "payeeNames" | "inviteUsers">> {
  const supabase = await createClient();
  const isRequest = (row: FeedRow) => row.entity_type === "request";
  // Finances' wording takes the action without the feed's "request." prefix.
  const edits = rows.filter(isRequest).map((row) => ({ ...row, action: row.action.replace(/^request\./, "") }));
  const [requests, payeeNames, inviteUsers] = await Promise.all([
    loadRequests(supabase, entityIds(rows, isRequest)),
    loadPayeeNames(supabase, changedPayeeIds(edits)),
    loadInviteUsers(supabase, entityIds(rows, (row) => row.entity_type === "invite")),
  ]);
  return { requests, payeeNames, inviteUsers };
}

/** Records that someone downloaded the feed. Throws if it can't, so nothing goes out unrecorded. */
export async function recordActivityExport(filename: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_event", { p_action: "activity.exported", p_entity_name: filename });
  if (error) throw error;
}

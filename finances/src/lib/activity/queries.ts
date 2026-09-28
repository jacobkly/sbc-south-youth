import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { ACTIVITY_KIND_ACTIONS, ACTIVITY_PAGE_SIZE, MAX_ACTIVITY_PAGES, type ActivityFilters } from "./feed";

const ACTIVITY_COLUMNS = `
  id, request_id, actor_id, action, from_status, note, changes, created_at,
  actor:users(full_name),
  request:reimbursement_requests(id, request_number, type, amount_cents, vendor, description, payee:payees(full_name))
`;

/** Every event the loaded pages hold, newest first. Throws if the query fails. */
export async function loadActivity(supabase: SupabaseClient<Database>, filters: ActivityFilters) {
  const shown = filters.pages * ACTIVITY_PAGE_SIZE;
  let query = supabase.from("request_events").select(ACTIVITY_COLUMNS);
  if (filters.kind !== "all") query = query.in("action", ACTIVITY_KIND_ACTIONS[filters.kind]);
  // One more than is shown, to know whether there are more. Supabase returns
  // at most 1,000, so on the last page the extra one doesn't come back.
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(0, shown);

  if (error) throw error;
  const events = data.slice(0, shown);
  return {
    events,
    hasMore: data.length > shown && filters.pages < MAX_ACTIVITY_PAGES,
    /** There may be older events than the most the page loads. */
    capped: filters.pages >= MAX_ACTIVITY_PAGES && events.length >= shown,
  };
}

/** An event as the activity page shows it. */
export type ActivityEvent = Awaited<ReturnType<typeof loadActivity>>["events"][number];

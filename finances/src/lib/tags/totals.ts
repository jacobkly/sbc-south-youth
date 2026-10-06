import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { REPORT_STATUSES } from "@/lib/reports/filters";
import type { RequestStatus } from "@/lib/requests/format";
import { ownDraftsFilter } from "@/lib/requests/queue";
import { fetchAll } from "@/lib/supabase/fetch-all";

export type TagStats = {
  /** Requests with the tag, in every status. */
  count: number;
  /** Cents on its approved and paid requests, as reports count them. */
  totalCents: number;
};

type TagLinkRow = { tag_id: string; request: { status: RequestStatus; amount_cents: number } | null };

const COUNTED = new Set<RequestStatus>(REPORT_STATUSES);

/** Each tag's count and total, by tag id. Tags on no request are left out. */
export function tagStats(rows: readonly TagLinkRow[]): Record<string, TagStats> {
  const stats: Record<string, TagStats> = {};
  for (const { tag_id, request } of rows) {
    if (!request) continue;
    const tag = (stats[tag_id] ??= { count: 0, totalCents: 0 });
    tag.count += 1;
    if (COUNTED.has(request.status)) tag.totalCents += request.amount_cents;
  }
  return stats;
}

/** What deleting a tag does, for its confirmation. */
export function removesFromText(count: number): string {
  if (count === 0) return "It isn't on any requests.";
  return `Removes it from ${count.toLocaleString("en-US")} ${count === 1 ? "request" : "requests"}.`;
}

/**
 * Every tag's count and total over all time, counting the requests the
 * request list shows `userId`, so a tag's count matches its filtered list.
 * Throws if a query fails.
 */
export async function loadTagStats(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Record<string, TagStats>> {
  const rows = await fetchAll((from, to) =>
    supabase
      .from("request_tags")
      .select("tag_id, request:reimbursement_requests!inner(status, amount_cents)")
      .or(ownDraftsFilter(userId), { referencedTable: "reimbursement_requests" })
      .order("request_id")
      .order("tag_id")
      .range(from, to),
  );
  return tagStats(rows);
}

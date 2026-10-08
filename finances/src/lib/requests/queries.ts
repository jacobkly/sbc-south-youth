import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database.types";
import { REPORT_STATUSES, reportBounds, type ReportFilters } from "@/lib/reports/filters";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { REQUEST_TAGS_EMBED, type RequestTagLinks } from "@/lib/tags/tags";
import type { RequestStatus } from "./format";
import {
  defaultTab,
  MAX_QUEUE_PAGES,
  ownDraftsFilter,
  QUEUE_PAGE_SIZE,
  QUEUE_TAB_STATUSES,
  QUEUE_TABS,
  searchFilter,
  sortsByPurchaseDate,
  type QueueFilters,
  type QueueTab,
} from "./queue";

// A requester can't read tags, so for them the embed comes back empty.
const QUEUE_COLUMNS =
  `id, request_number, status, type, amount_cents, purchase_date, paid_at, sort_at, vendor, description, missing_receipt, payee:payees(full_name), ${REQUEST_TAGS_EMBED}` as const;
const TAG_FILTER = "tagged:request_tags!inner()";
const REPORT_COLUMNS =
  `${QUEUE_COLUMNS}, payee_id, submitted_at, approved_at, payment_method, no_receipt_reason, lines:request_lines(vendor, amount_cents)` as const;
const EXPORT_COLUMNS = `
  request_number, status, type, amount_cents, purchase_date, vendor, description, ${REQUEST_TAGS_EMBED},
  submitted_at, external_approver, approved_at, paid_at, payment_method, payment_reference, no_receipt, no_receipt_reason,
  payee:payees(full_name),
  entered_by:users!reimbursement_requests_created_by_fkey(full_name),
  approver:users!reimbursement_requests_approved_by_fkey(full_name),
  payer:users!reimbursement_requests_paid_by_fkey(full_name),
  receipts(count)
` as const;

/** A request as the queue lists it. */
export type QueueRow = Pick<
  Tables<"reimbursement_requests">,
  | "id"
  | "request_number"
  | "status"
  | "type"
  | "amount_cents"
  | "purchase_date"
  | "paid_at"
  | "sort_at"
  | "vendor"
  | "description"
  | "missing_receipt"
> & { payee: { full_name: string } | null; tags: RequestTagLinks };

export type QueuePage = {
  /** The tab shown: the one in the URL, or the one picked for it. */
  tab: QueueTab;
  /** Newest first, by paid or created date, or by purchase date when a range is set. */
  rows: QueueRow[];
  /** How many requests in each tab match the filters. */
  counts: Record<QueueTab, number>;
  /** More match than were loaded, and "Load more" can fetch them. */
  hasMore: boolean;
  /** With a tag filter on, the cents approved or paid that match, in every tab. */
  total: number | null;
};

/**
 * The columns of requests with one of these statuses, or any status, that
 * match the filters. `payeeIds` are the payees whose names match the search,
 * and `userId` is who's looking, whose drafts show.
 */
function queueQuery<Columns extends string>(
  supabase: SupabaseClient<Database>,
  columns: Columns,
  statuses: readonly RequestStatus[] | null,
  filters: QueueFilters,
  payeeIds: readonly string[],
  userId: string,
  options?: { count: "exact"; head: true },
) {
  // A tag filter joins the tag's links without returning any, so the rows
  // come back the same and each still lists all its tags.
  const select = (filters.tag ? `${columns}, ${TAG_FILTER}` : columns) as Columns;
  let query = supabase.from("reimbursement_requests").select(select, options).or(ownDraftsFilter(userId));
  if (statuses) query = query.in("status", statuses);
  if (filters.from) query = query.gte("purchase_date", filters.from);
  if (filters.to) query = query.lte("purchase_date", filters.to);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.payee) query = query.eq("payee_id", filters.payee);
  if (filters.tag) query = query.eq("tagged.tag_id", filters.tag);
  if (filters.missingReceipt) query = query.eq("missing_receipt", true);
  if (filters.q) query = query.or(searchFilter(filters.q, payeeIds));
  return query;
}

/** The cents approved or paid that match the filters, in every tab. Throws if a query fails. */
async function loadTotal(
  supabase: SupabaseClient<Database>,
  filters: QueueFilters,
  payeeIds: readonly string[],
  userId: string,
): Promise<number> {
  const rows = await fetchAll((from, to) =>
    queueQuery(supabase, "amount_cents", REPORT_STATUSES, filters, payeeIds, userId).order("id").range(from, to),
  );
  return rows.reduce((sum, row) => sum + row.amount_cents, 0);
}

/** How many requests in each tab match the filters. Throws if a query fails. */
async function loadCounts(
  supabase: SupabaseClient<Database>,
  filters: QueueFilters,
  payeeIds: readonly string[],
  userId: string,
): Promise<Record<QueueTab, number>> {
  const results = await Promise.all(
    QUEUE_TABS.map((tab) =>
      queueQuery(supabase, "id", QUEUE_TAB_STATUSES[tab], filters, payeeIds, userId, { count: "exact", head: true }),
    ),
  );
  return Object.fromEntries(
    QUEUE_TABS.map((tab, index) => {
      const { count, error } = results[index];
      if (error) throw error;
      return [tab, count ?? 0];
    }),
  ) as Record<QueueTab, number>;
}

/**
 * The loaded pages of the current tab, and the count in every tab. When the
 * URL doesn't name a tab, the counts pick one. Drafts show only to the person
 * who started them. Throws if a query fails.
 */
export async function loadQueue(
  supabase: SupabaseClient<Database>,
  filters: QueueFilters,
  payeeIds: readonly string[],
  userId: string,
): Promise<QueuePage> {
  const counting = loadCounts(supabase, filters, payeeIds, userId);
  // Only waits for the counts first when it needs them to pick the tab.
  const tab = filters.tab ?? defaultTab(await counting);
  const [rows, counts, total] = await Promise.all([
    queueQuery(supabase, QUEUE_COLUMNS, QUEUE_TAB_STATUSES[tab], filters, payeeIds, userId)
      .order(sortsByPurchaseDate(filters) ? "purchase_date" : "sort_at", { ascending: false })
      .order("request_number", { ascending: false })
      .range(0, filters.pages * QUEUE_PAGE_SIZE - 1),
    counting,
    filters.tag ? loadTotal(supabase, filters, payeeIds, userId) : null,
  ]);

  if (rows.error) throw rows.error;

  return {
    tab,
    rows: rows.data,
    counts,
    hasMore: counts[tab] > rows.data.length && filters.pages < MAX_QUEUE_PAGES,
    total,
  };
}

/**
 * The newest requests by paid or created date, and how many there are in all.
 * Drafts show only to `userId`, who started them. Throws if the query fails.
 */
export async function loadRecentRequests(
  supabase: SupabaseClient<Database>,
  limit: number,
  userId: string,
): Promise<{ rows: QueueRow[]; total: number }> {
  const { data, count, error } = await supabase
    .from("reimbursement_requests")
    .select(QUEUE_COLUMNS, { count: "exact" })
    .or(ownDraftsFilter(userId))
    .order("sort_at", { ascending: false })
    .order("request_number", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return { rows: data, total: count ?? data.length };
}

/**
 * A payee's newest requests by paid or created date, and how many they have
 * in all. With `draftsBy`, drafts show only when that person started them.
 * Throws if the query fails.
 */
export async function loadPayeeRequests(
  supabase: SupabaseClient<Database>,
  payeeId: string,
  limit: number,
  draftsBy?: string,
): Promise<{ rows: QueueRow[]; total: number }> {
  let query = supabase.from("reimbursement_requests").select(QUEUE_COLUMNS, { count: "exact" }).eq("payee_id", payeeId);
  if (draftsBy) query = query.or(ownDraftsFilter(draftsBy));
  const { data, count, error } = await query
    .order("sort_at", { ascending: false })
    .order("request_number", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return { rows: data, total: count ?? data.length };
}

/** A request as a report lists it. */
export type ReportRow = QueueRow &
  Pick<
    Tables<"reimbursement_requests">,
    "payee_id" | "submitted_at" | "approved_at" | "payment_method" | "no_receipt_reason"
  > & { lines: Pick<Tables<"request_lines">, "vendor" | "amount_cents">[] };

/** The requests in a report with the given columns, newest first by the report's date. */
function reportQuery<Columns extends string>(
  supabase: SupabaseClient<Database>,
  filters: ReportFilters,
  columns: Columns,
) {
  const { column, from, before, statuses } = reportBounds(filters);
  let query = supabase.from("reimbursement_requests").select(columns).gte(column, from).lt(column, before);
  if (statuses) query = query.in("status", statuses);
  return query.order(column, { ascending: false }).order("request_number", { ascending: false });
}

/** Every request in a report. By paid date, only paid requests count. Throws if a query fails. */
export async function loadReport(supabase: SupabaseClient<Database>, filters: ReportFilters): Promise<ReportRow[]> {
  return fetchAll((from, to) => reportQuery(supabase, filters, REPORT_COLUMNS).range(from, to));
}

/** The amounts, dates, and statuses in a report, to compare another report with. Throws if a query fails. */
export async function loadReportAmounts(supabase: SupabaseClient<Database>, filters: ReportFilters) {
  return fetchAll((from, to) =>
    reportQuery(supabase, filters, "type, amount_cents, purchase_date, paid_at, status").range(from, to),
  );
}

/**
 * The payees with a request the report would count from before its period,
 * so its other payees are new. One request each is enough to know. Throws if
 * a query fails.
 */
export async function loadReturningPayees(supabase: SupabaseClient<Database>, filters: ReportFilters) {
  const { column, from, statuses } = reportBounds(filters);
  const rows = await fetchAll((start, end) => {
    let query = supabase
      .from("payees")
      .select("id, reimbursement_requests!inner(id)")
      .lt(`reimbursement_requests.${column}`, from)
      .limit(1, { referencedTable: "reimbursement_requests" });
    if (statuses) query = query.in("reimbursement_requests.status", statuses);
    return query.order("id").range(start, end);
  });
  return rows.map((row) => row.id);
}

/** Every request in a report with everything the CSV needs. Throws if a query fails. */
export async function loadReportExport(supabase: SupabaseClient<Database>, filters: ReportFilters) {
  return fetchAll((from, to) => reportQuery(supabase, filters, EXPORT_COLUMNS).range(from, to));
}

/** A request as the CSV export has it. */
export type ReportExportRow = Awaited<ReturnType<typeof loadReportExport>>[number];

/** Payees' names by id, for the payees that edits mention. Throws if the query fails. */
export async function loadPayeeNames(
  supabase: SupabaseClient<Database>,
  ids: readonly string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from("payees").select("id, full_name").in("id", ids);
  if (error) throw error;
  return new Map(data.map((payee) => [payee.id, payee.full_name]));
}

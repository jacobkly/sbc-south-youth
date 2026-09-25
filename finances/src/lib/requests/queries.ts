import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database.types";
import { reportBounds, type ReportFilters } from "@/lib/reports/filters";
import { fetchAll } from "@/lib/supabase/fetch-all";
import {
  MAX_QUEUE_PAGES,
  QUEUE_PAGE_SIZE,
  QUEUE_TAB_STATUSES,
  QUEUE_TABS,
  searchFilter,
  type QueueFilters,
  type QueueTab,
} from "./queue";

const QUEUE_COLUMNS =
  "id, request_number, status, type, amount_cents, purchase_date, vendor, no_receipt, payee:payees(full_name)";
const REPORT_COLUMNS = `${QUEUE_COLUMNS}, paid_at` as const;
const EXPORT_COLUMNS = `
  request_number, status, type, amount_cents, purchase_date, vendor, description, event_name,
  submitted_at, external_approver, approved_at, paid_at, payment_method, payment_reference, no_receipt_reason,
  payee:payees(full_name),
  entered_by:users!reimbursement_requests_created_by_fkey(full_name),
  approver:users!reimbursement_requests_approved_by_fkey(full_name),
  payer:users!reimbursement_requests_paid_by_fkey(full_name),
  receipts(count)
`;

/** A request as the queue lists it. */
export type QueueRow = Pick<
  Tables<"reimbursement_requests">,
  "id" | "request_number" | "status" | "type" | "amount_cents" | "purchase_date" | "vendor" | "no_receipt"
> & { payee: { full_name: string } | null };

export type QueuePage = {
  /** Newest purchase first. */
  rows: QueueRow[];
  /** How many requests in each tab match the filters. */
  counts: Record<QueueTab, number>;
  /** More match than were loaded, and "Load more" can fetch them. */
  hasMore: boolean;
};

/** Requests in one tab that match the filters. `payeeIds` are the payees whose names match the search. */
function queueQuery(
  supabase: SupabaseClient<Database>,
  tab: QueueTab,
  filters: QueueFilters,
  payeeIds: readonly string[],
  options?: { count: "exact"; head: true },
) {
  let query = supabase.from("reimbursement_requests").select(QUEUE_COLUMNS, options);
  const statuses = QUEUE_TAB_STATUSES[tab];
  if (statuses) query = query.in("status", statuses);
  if (filters.from) query = query.gte("purchase_date", filters.from);
  if (filters.to) query = query.lte("purchase_date", filters.to);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.payee) query = query.eq("payee_id", filters.payee);
  if (filters.noReceipt) query = query.eq("no_receipt", true);
  if (filters.q) query = query.or(searchFilter(filters.q, payeeIds));
  return query;
}

/** The loaded pages of the current tab, and the count in every tab. Throws if a query fails. */
export async function loadQueue(
  supabase: SupabaseClient<Database>,
  filters: QueueFilters,
  payeeIds: readonly string[],
): Promise<QueuePage> {
  const [rows, counts] = await Promise.all([
    queueQuery(supabase, filters.tab, filters, payeeIds)
      .order("purchase_date", { ascending: false })
      .order("request_number", { ascending: false })
      .range(0, filters.pages * QUEUE_PAGE_SIZE - 1),
    Promise.all(
      QUEUE_TABS.map((tab) => queueQuery(supabase, tab, filters, payeeIds, { count: "exact", head: true })),
    ),
  ]);

  if (rows.error) throw rows.error;
  const byTab = Object.fromEntries(
    QUEUE_TABS.map((tab, index) => {
      const { count, error } = counts[index];
      if (error) throw error;
      return [tab, count ?? 0];
    }),
  ) as Record<QueueTab, number>;

  return {
    rows: rows.data,
    counts: byTab,
    hasMore: byTab[filters.tab] > rows.data.length && filters.pages < MAX_QUEUE_PAGES,
  };
}

/** A payee's newest requests, and how many they have in all. Throws if the query fails. */
export async function loadPayeeRequests(
  supabase: SupabaseClient<Database>,
  payeeId: string,
  limit: number,
): Promise<{ rows: QueueRow[]; total: number }> {
  const { data, count, error } = await supabase
    .from("reimbursement_requests")
    .select(QUEUE_COLUMNS, { count: "exact" })
    .eq("payee_id", payeeId)
    .order("purchase_date", { ascending: false })
    .order("request_number", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return { rows: data, total: count ?? data.length };
}

/** A request as a report lists it. */
export type ReportRow = QueueRow & Pick<Tables<"reimbursement_requests">, "paid_at">;

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

/** Every request in a report with everything the CSV needs. Throws if a query fails. */
export async function loadReportExport(supabase: SupabaseClient<Database>, filters: ReportFilters) {
  return fetchAll((from, to) => reportQuery(supabase, filters, EXPORT_COLUMNS).range(from, to));
}

/** A request as the CSV export has it. */
export type ReportExportRow = Awaited<ReturnType<typeof loadReportExport>>[number];

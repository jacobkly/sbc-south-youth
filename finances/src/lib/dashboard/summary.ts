import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { periodContaining, periodRange, type IsoDate, type Period } from "@/lib/dates";
import { fetchAll } from "@/lib/supabase/fetch-all";

export type PaidPeriod = { period: Period; cents: number };

export type PaidTotals = { month: PaidPeriod; quarter: PaidPeriod; year: PaidPeriod };

export type DashboardSummary = {
  awaitingReview: number;
  /** Approved and not paid yet. */
  toPay: { count: number; cents: number };
  paid: PaidTotals;
  /** Bytes of receipts in Supabase Storage. */
  storageBytes: number;
  /** False until the first request is entered, drafts included for admins. */
  hasRequests: boolean;
};

type PaidRow = { paid_date: IsoDate | null; amount_cents: number | null };

/** Cents paid in the month, quarter, and year that contain `today`, by the LA date paid. */
export function paidTotals(rows: readonly PaidRow[], today: IsoDate): PaidTotals {
  function total(kind: "month" | "quarter" | "year"): PaidPeriod {
    const period = periodContaining(kind, today);
    const { start, end } = periodRange(period);
    let cents = 0;
    for (const row of rows) {
      if (row.paid_date && row.paid_date >= start && row.paid_date <= end) cents += row.amount_cents ?? 0;
    }
    return { period, cents };
  }
  return { month: total("month"), quarter: total("quarter"), year: total("year") };
}

/** Everything the dashboard shows. Throws if a query fails. */
export async function loadDashboard(supabase: SupabaseClient<Database>, today: IsoDate): Promise<DashboardSummary> {
  const year = periodRange(periodContaining("year", today));
  const [awaiting, all, toPay, paid, storage] = await Promise.all([
    supabase.from("reimbursement_requests").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("reimbursement_requests").select("id", { count: "exact", head: true }),
    fetchAll((from, to) =>
      supabase
        .from("reimbursement_requests")
        .select("amount_cents")
        .eq("status", "approved")
        .order("id")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("request_report")
        .select("paid_date, amount_cents")
        .eq("status", "paid")
        .gte("paid_date", year.start)
        .lte("paid_date", year.end)
        .order("id")
        .range(from, to),
    ),
    supabase.rpc("storage_usage"),
  ]);

  if (awaiting.error) throw awaiting.error;
  if (all.error) throw all.error;
  if (storage.error) throw storage.error;

  return {
    awaitingReview: awaiting.count ?? 0,
    toPay: { count: toPay.length, cents: toPay.reduce((sum, row) => sum + row.amount_cents, 0) },
    paid: paidTotals(paid, today),
    storageBytes: storage.data,
    hasRequests: (all.count ?? 0) > 0,
  };
}

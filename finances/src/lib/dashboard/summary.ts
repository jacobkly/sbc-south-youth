import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  periodContaining,
  periodRange,
  recentMonths,
  type IsoDate,
  type MonthPeriod,
  type Period,
} from "@/lib/dates";
import type { RequestType } from "@/lib/requests/schema";
import { fetchAll } from "@/lib/supabase/fetch-all";

/** Months shown in the dashboard's monthly chart, this month included. */
export const CHART_MONTHS = 12;

export type TypeCents = Record<RequestType, number>;

export type PaidPeriod<P extends Period = Period> = {
  period: P;
  /** Always `byType.cafe + byType.youth`. */
  cents: number;
  byType: TypeCents;
};

export type PaidTotals = { month: PaidPeriod; quarter: PaidPeriod; year: PaidPeriod };

export type DashboardSummary = {
  awaitingReview: number;
  /** Approved and not paid yet. */
  toPay: { count: number; cents: number };
  paid: PaidTotals;
  /** The last 12 months, oldest first, ending with this month. */
  paidByMonth: PaidPeriod<MonthPeriod>[];
  /** Bytes of receipts in Supabase Storage. */
  storageBytes: number;
  /** False until the first request is entered, drafts included for admins. */
  hasRequests: boolean;
};

type PaidRow = { paid_date: IsoDate | null; amount_cents: number | null; type: RequestType | null };

/** Cents paid in a period by the LA date paid, split by type. */
export function paidIn<P extends Period>(rows: readonly PaidRow[], period: P): PaidPeriod<P> {
  const { start, end } = periodRange(period);
  const byType: TypeCents = { cafe: 0, youth: 0 };
  for (const row of rows) {
    if (row.type && row.paid_date && row.paid_date >= start && row.paid_date <= end) {
      byType[row.type] += row.amount_cents ?? 0;
    }
  }
  return { period, cents: byType.cafe + byType.youth, byType };
}

/** Cents paid in the month, quarter, and year that contain `today`. */
export function paidTotals(rows: readonly PaidRow[], today: IsoDate): PaidTotals {
  return {
    month: paidIn(rows, periodContaining("month", today)),
    quarter: paidIn(rows, periodContaining("quarter", today)),
    year: paidIn(rows, periodContaining("year", today)),
  };
}

/** Cents paid in each of the last `count` months, oldest first. */
export function paidByMonth(rows: readonly PaidRow[], today: IsoDate, count = CHART_MONTHS): PaidPeriod<MonthPeriod>[] {
  return recentMonths(count, today).map((month) => paidIn(rows, month));
}

/**
 * A part's share of a total as a whole percent, e.g. "62%". A share that
 * rounds to 0 or 100 but isn't shows as "<1%" or ">99%".
 */
export function sharePercent(part: number, total: number): string {
  if (total <= 0) return "0%";
  const percent = Math.round((part / total) * 100);
  if (percent === 0 && part > 0) return "<1%";
  if (percent === 100 && part < total) return ">99%";
  return `${percent}%`;
}

/** Everything the dashboard shows. Throws if a query fails. */
export async function loadDashboard(supabase: SupabaseClient<Database>, today: IsoDate): Promise<DashboardSummary> {
  // The chart's 12 months always reach back to this year's January, so one
  // query covers the charts and the month, quarter, and year cards. Paid
  // dates are never in the future, so ending at this month misses nothing.
  const months = recentMonths(CHART_MONTHS, today);
  const from = periodRange(months[0]).start;
  const to = periodRange(months[months.length - 1]).end;

  const [awaiting, all, toPay, paid, storage] = await Promise.all([
    supabase.from("reimbursement_requests").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("reimbursement_requests").select("id", { count: "exact", head: true }),
    fetchAll((start, end) =>
      supabase
        .from("reimbursement_requests")
        .select("amount_cents")
        .eq("status", "approved")
        .order("id")
        .range(start, end),
    ),
    fetchAll((start, end) =>
      supabase
        .from("request_report")
        .select("paid_date, amount_cents, type")
        .eq("status", "paid")
        .gte("paid_date", from)
        .lte("paid_date", to)
        .order("id")
        .range(start, end),
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
    paidByMonth: paidByMonth(paid, today),
    storageBytes: storage.data,
    hasRequests: (all.count ?? 0) > 0,
  };
}

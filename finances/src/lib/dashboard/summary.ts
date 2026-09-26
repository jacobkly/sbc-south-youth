import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  addDays,
  daysBetween,
  periodContaining,
  periodRange,
  recentMonths,
  shiftPeriod,
  type CalendarPeriod,
  type DateRange,
  type IsoDate,
  type MonthPeriod,
  type Period,
} from "@/lib/dates";
import type { RequestStatus } from "@/lib/requests/format";
import { loadRecentRequests, type QueueRow } from "@/lib/requests/queries";
import type { RequestType } from "@/lib/requests/schema";
import { fetchAll } from "@/lib/supabase/fetch-all";

/** Months shown in the dashboard's monthly chart, this month included. */
export const CHART_MONTHS = 12;
/** Payees shown in the dashboard's top payees. */
export const TOP_PAYEES = 5;
/** Requests shown in the dashboard's latest requests. */
export const LATEST_REQUESTS = 5;

export type TypeCents = Record<RequestType, number>;

export type PaidPeriod<P extends Period = Period> = {
  period: P;
  /** Always `byType.cafe + byType.youth`. */
  cents: number;
  byType: TypeCents;
};

export type PaidKind = "month" | "quarter" | "year";

export type PaidTotals = Record<PaidKind, PaidPeriod>;

export type StatusTotal = { count: number; cents: number };

export type PayeeTotal = { id: string; name: string; cents: number; count: number };

export type Trend = { direction: "up" | "down" | "same"; percent: number };

export type DashboardSummary = {
  /** Submitted and waiting for review. */
  awaitingReview: StatusTotal;
  needsInfo: StatusTotal;
  /** Approved and not paid yet. */
  toPay: StatusTotal;
  paid: PaidTotals;
  /** Paid in the month, quarter, and year before, up to the same point as today. */
  paidBefore: Record<PaidKind, number>;
  /** The last 12 months, oldest first, ending with this month. */
  paidByMonth: PaidPeriod<MonthPeriod>[];
  /** Who was paid the most this year, most first. */
  topPayees: PayeeTotal[];
  activePayees: number;
  /** The newest requests by purchase date. */
  latest: QueueRow[];
  /** Bytes of receipts in Supabase Storage. */
  storageBytes: number;
  /** False until the first request is entered, drafts included for admins. */
  hasRequests: boolean;
};

type PaidRow = { paid_date: IsoDate | null; amount_cents: number | null; type: RequestType | null };

function inRange(date: IsoDate | null, { start, end }: DateRange): date is IsoDate {
  return date !== null && date >= start && date <= end;
}

/** Cents paid in a period by the LA date paid, split by type. */
export function paidIn<P extends Period>(rows: readonly PaidRow[], period: P): PaidPeriod<P> {
  const range = periodRange(period);
  const byType: TypeCents = { cafe: 0, youth: 0 };
  for (const row of rows) {
    if (row.type && inRange(row.paid_date, range)) byType[row.type] += row.amount_cents ?? 0;
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

/**
 * The start of the period before `period`, through as many days in as
 * `today` is into `period`. On September 25 that's August 1–25 for the
 * month, and April 1–June 26 for the quarter. It stops at the end of the
 * period before when that one is shorter.
 */
export function samePointBefore(period: CalendarPeriod, today: IsoDate): DateRange {
  const before = periodRange(shiftPeriod(period, -1));
  const end = addDays(before.start, daysBetween(periodRange(period).start, today));
  return { start: before.start, end: end < before.end ? end : before.end };
}

/** Cents paid in the month, quarter, and year before, up to the same point as today. */
export function paidBefore(rows: readonly PaidRow[], today: IsoDate): Record<PaidKind, number> {
  const sum = (kind: PaidKind) => {
    const range = samePointBefore(periodContaining(kind, today), today);
    return paidIn(rows, { kind: "custom", ...range }).cents;
  };
  return { month: sum("month"), quarter: sum("quarter"), year: sum("year") };
}

/** How `current` compares with `before`, as a whole percent. Null when there's nothing to compare with. */
export function trend(current: number, before: number): Trend | null {
  if (before <= 0) return null;
  const percent = Math.round((Math.abs(current - before) / before) * 100);
  if (percent === 0) return { direction: "same", percent };
  return { direction: current > before ? "up" : "down", percent };
}

/** Cents paid in each of the last `count` months, oldest first. */
export function paidByMonth(rows: readonly PaidRow[], today: IsoDate, count = CHART_MONTHS): PaidPeriod<MonthPeriod>[] {
  return recentMonths(count, today).map((month) => paidIn(rows, month));
}

/**
 * The payees paid the most in a period, most first, ties by name. Payees
 * missing from `names` are skipped.
 */
export function topPayees(
  rows: readonly (PaidRow & { payee_id: string | null })[],
  names: ReadonlyMap<string, string>,
  period: Period,
  limit = TOP_PAYEES,
): PayeeTotal[] {
  const range = periodRange(period);
  const totals = new Map<string, PayeeTotal>();
  for (const row of rows) {
    if (!row.payee_id || !inRange(row.paid_date, range)) continue;
    const name = names.get(row.payee_id);
    if (name === undefined) continue;
    const total = totals.get(row.payee_id) ?? { id: row.payee_id, name, cents: 0, count: 0 };
    total.cents += row.amount_cents ?? 0;
    total.count += 1;
    totals.set(row.payee_id, total);
  }
  return [...totals.values()]
    .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Count and cents of the requests in one status. */
export function statusTotal(rows: readonly { status: RequestStatus; amount_cents: number }[], status: RequestStatus) {
  const total: StatusTotal = { count: 0, cents: 0 };
  for (const row of rows) {
    if (row.status !== status) continue;
    total.count += 1;
    total.cents += row.amount_cents;
  }
  return total;
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
  // From the start of last year, which covers the year-over-year comparison
  // and the chart's 12 months. Paid dates are never in the future, so
  // ending at this month misses nothing.
  const from = periodRange(shiftPeriod(periodContaining("year", today), -1)).start;
  const to = periodRange(periodContaining("month", today)).end;

  const [open, paid, payees, latest, storage] = await Promise.all([
    fetchAll((start, end) =>
      supabase
        .from("reimbursement_requests")
        .select("status, amount_cents")
        .in("status", ["submitted", "needs_info", "approved"])
        .order("id")
        .range(start, end),
    ),
    fetchAll((start, end) =>
      supabase
        .from("request_report")
        .select("paid_date, amount_cents, type, payee_id")
        .eq("status", "paid")
        .gte("paid_date", from)
        .lte("paid_date", to)
        .order("id")
        .range(start, end),
    ),
    fetchAll((start, end) =>
      supabase.from("payees").select("id, full_name, is_active").order("id").range(start, end),
    ),
    loadRecentRequests(supabase, LATEST_REQUESTS),
    supabase.rpc("storage_usage"),
  ]);

  if (storage.error) throw storage.error;

  const names = new Map(payees.map((payee) => [payee.id, payee.full_name]));
  const totals = paidTotals(paid, today);

  return {
    awaitingReview: statusTotal(open, "submitted"),
    needsInfo: statusTotal(open, "needs_info"),
    toPay: statusTotal(open, "approved"),
    paid: totals,
    paidBefore: paidBefore(paid, today),
    paidByMonth: paidByMonth(paid, today),
    topPayees: topPayees(paid, names, totals.year.period),
    activePayees: payees.filter((payee) => payee.is_active).length,
    latest: latest.rows,
    storageBytes: storage.data,
    hasRequests: latest.total > 0,
  };
}

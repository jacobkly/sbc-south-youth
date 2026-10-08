import { periodContaining, periodRange, shiftPeriod, type MonthPeriod, type Period } from "@/lib/dates";
import type { CafeWeek } from "@/lib/income/cafe";
import type { YouthEntry } from "@/lib/income/stats";
import type { RequestStatus } from "@/lib/requests/format";
import type { RequestType } from "@/lib/requests/schema";
import { REPORT_STATUSES } from "./filters";

/** A report period's youth entries and cafe weeks. */
export type ReportIncome = { youth: YouthEntry[]; weeks: CafeWeek[] };

/** A request as the Income tab counts it. */
export type OutRow = { type: RequestType; amount_cents: number; status: RequestStatus };

export type IncomeTotals = {
  moneyIn: Record<RequestType, number> & { total: number };
  out: Record<RequestType, number> & { total: number; count: number };
  /** Below 0 when more went out than came in. */
  left: number;
  /** Each type's money in minus its requests. */
  profit: Record<RequestType, number>;
};

const counted = new Set<RequestStatus>(REPORT_STATUSES);

/**
 * A period's money in against the report's requests. Only approved and paid
 * requests count as out, even with All statuses on, since the rest weren't
 * spent.
 */
export function incomeTotals({ youth, weeks }: ReportIncome, rows: readonly OutRow[]): IncomeTotals {
  const moneyIn = {
    youth: youth.reduce((total, entry) => total + entry.amount_cents, 0),
    cafe: weeks.reduce((total, week) => total + week.sales_cents, 0),
  };
  const out = { youth: 0, cafe: 0, total: 0, count: 0 };
  for (const row of rows) {
    if (!counted.has(row.status)) continue;
    out[row.type] += row.amount_cents;
    out.total += row.amount_cents;
    out.count += 1;
  }
  const total = moneyIn.youth + moneyIn.cafe;
  return {
    moneyIn: { ...moneyIn, total },
    out,
    left: total - out.total,
    profit: { cafe: moneyIn.cafe - out.cafe, youth: moneyIn.youth - out.youth },
  };
}

export type TitheMonth = {
  period: MonthPeriod;
  count: number;
  total: number;
  /** In whole cents. Null with no tithes. */
  average: number | null;
};

/**
 * Each month the period touches, oldest first, with its tithes. A custom
 * range's first and last months count only its own days. Events stay out,
 * like the tithe stats.
 */
export function titheMonths(entries: readonly YouthEntry[], period: Period): TitheMonth[] {
  const { start, end } = periodRange(period);
  const months: TitheMonth[] = [];
  const byKey = new Map<string, TitheMonth>();
  for (
    let month = periodContaining("month", start) as MonthPeriod;
    periodRange(month).start <= end;
    month = shiftPeriod(month, 1) as MonthPeriod
  ) {
    const row = { period: month, count: 0, total: 0, average: null };
    months.push(row);
    byKey.set(periodRange(month).start.slice(0, 7), row);
  }
  for (const entry of entries) {
    if (entry.kind !== "tithe" || entry.received_on < start || entry.received_on > end) continue;
    const row = byKey.get(entry.received_on.slice(0, 7));
    if (!row) continue;
    row.count += 1;
    row.total += entry.amount_cents;
  }
  return months.map((row) => ({ ...row, average: row.count ? Math.round(row.total / row.count) : null }));
}

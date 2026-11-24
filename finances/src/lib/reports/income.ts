import { periodContaining, periodRange, shiftPeriod, type MonthPeriod, type Period } from "@/lib/dates";
import type { CafePayback, CafeWeek } from "@/lib/income/cafe";
import { earnedIncome, type EarnedIncome } from "@/lib/income/earned";
import type { YouthEntry } from "@/lib/income/stats";
import type { RequestStatus } from "@/lib/requests/format";
import type { RequestType } from "@/lib/requests/schema";
import { REPORT_STATUSES } from "./filters";

/** A report period's youth entries, cafe weeks, and the church's paybacks for the cafe's discounts and gift cards. */
export type ReportIncome = { youth: YouthEntry[]; weeks: CafeWeek[]; paybacks: CafePayback[] };

/** A request as income and profit count it. */
export type OutRow = { type: RequestType; amount_cents: number; status: RequestStatus };

export type IncomeTotals = {
  /** What was earned, which profit counts. */
  income: EarnedIncome;
  /** The cafe's is its money from Square. Paybacks count on the day they came in. */
  moneyIn: Record<RequestType, number> & { paybacks: number; total: number };
  out: Record<RequestType, number> & { total: number; count: number };
  /** Below 0 when more went out than came in. */
  left: number;
  /** Income minus requests, for each type and in all. */
  profit: Record<RequestType, number> & { total: number };
};

const counted = new Set<RequestStatus>(REPORT_STATUSES);

/** Only approved and paid requests are expenses, even with All statuses on. The rest weren't spent. */
export function wasSpent(row: { status: RequestStatus }): boolean {
  return counted.has(row.status);
}

/** Whether there was any income, money in, or expenses to show. */
export function hasMoney({ income, moneyIn, out }: IncomeTotals): boolean {
  return income.total !== 0 || moneyIn.total !== 0 || out.count > 0;
}

/**
 * A period's income and money in against the report's requests. Money in is
 * what reached the bank, so a payback counts when it came in. Income, and so
 * profit, counts the cafe's discounts in the week they were given, like the
 * Cafe tab. The church's gift card money counts in both when it came in,
 * since nothing is owed for it.
 */
export function incomeTotals(sources: ReportIncome, rows: readonly OutRow[]): IncomeTotals {
  const income = earnedIncome(sources);
  const moneyIn = {
    youth: income.youth,
    cafe: income.square,
    paybacks: sources.paybacks.reduce((total, payback) => total + payback.amount_cents, 0),
  };
  const out = { youth: 0, cafe: 0, total: 0, count: 0 };
  for (const row of rows) {
    if (!wasSpent(row)) continue;
    out[row.type] += row.amount_cents;
    out.total += row.amount_cents;
    out.count += 1;
  }
  const total = moneyIn.youth + moneyIn.cafe + moneyIn.paybacks;
  return {
    income,
    moneyIn: { ...moneyIn, total },
    out,
    left: total - out.total,
    profit: { cafe: income.cafe - out.cafe, youth: income.youth - out.youth, total: income.total - out.total },
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

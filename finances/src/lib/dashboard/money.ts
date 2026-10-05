import { periodRange, type MonthPeriod, type Period } from "@/lib/dates";
import { cafeTotalsIn, type CafeCost, type CafeSales } from "@/lib/income/cafe";
import type { YouthEntry } from "@/lib/income/stats";
import type { PaidKind, PaidPeriod, PaidTotals } from "./summary";

/** What totals need from a youth entry. */
export type YouthIncome = Pick<YouthEntry, "received_on" | "amount_cents">;

export type MoneyIn = {
  /** Tithes and events. */
  youth: number;
  /** Cafe sales. */
  cafe: number;
  total: number;
};

export type MoneyPeriod<P extends Period = Period> = {
  period: P;
  moneyIn: MoneyIn;
  /** The dashboard's paid total for the period, by the date paid. */
  paidOut: number;
  /** Below 0 when more was paid out than came in. */
  left: number;
};

export type MoneyTotals = Record<PaidKind, MoneyPeriod & { cafeProfit: number }>;

/** Youth income by the date given, and cafe sales by the week's last day, in a period. */
export function moneyIn(youth: readonly YouthIncome[], weeks: readonly CafeSales[], period: Period): MoneyIn {
  const { start, end } = periodRange(period);
  const inRange = (date: string) => date >= start && date <= end;
  const youthCents = youth.reduce((total, entry) => (inRange(entry.received_on) ? total + entry.amount_cents : total), 0);
  const cafeCents = weeks.reduce((total, week) => (inRange(week.week_ending) ? total + week.sales_cents : total), 0);
  return { youth: youthCents, cafe: cafeCents, total: youthCents + cafeCents };
}

function moneyPeriod<P extends Period>(
  youth: readonly YouthIncome[],
  weeks: readonly CafeSales[],
  paid: PaidPeriod<P>,
): MoneyPeriod<P> {
  const income = moneyIn(youth, weeks, paid.period);
  return { period: paid.period, moneyIn: income, paidOut: paid.cents, left: income.total - paid.cents };
}

/**
 * Money in, paid out, and what's left in the month, quarter, and year of the
 * paid totals, plus cafe profit. Profit counts cafe costs by purchase date,
 * like the Income page, so the two always agree.
 */
export function moneyTotals(
  youth: readonly YouthIncome[],
  weeks: readonly CafeSales[],
  cafeCosts: readonly CafeCost[],
  paid: PaidTotals,
): MoneyTotals {
  const totals = (kind: PaidKind) => ({
    ...moneyPeriod(youth, weeks, paid[kind]),
    cafeProfit: cafeTotalsIn(weeks, cafeCosts, paid[kind].period).profit,
  });
  return { month: totals("month"), quarter: totals("quarter"), year: totals("year") };
}

/** Money in, paid out, and what's left in each of the paid chart's months. */
export function moneyByMonth(
  youth: readonly YouthIncome[],
  weeks: readonly CafeSales[],
  paidMonths: readonly PaidPeriod<MonthPeriod>[],
): MoneyPeriod<MonthPeriod>[] {
  return paidMonths.map((month) => moneyPeriod(youth, weeks, month));
}

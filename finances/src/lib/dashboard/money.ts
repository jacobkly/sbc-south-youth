import { periodRange, type MonthPeriod, type Period } from "@/lib/dates";
import { cafeTotalsIn, moneyFromSquare, type CafeCost, type CafePayback, type CafeSales } from "@/lib/income/cafe";
import type { YouthEntry } from "@/lib/income/stats";
import type { PaidKind, PaidPeriod, PaidTotals } from "./summary";

/** What totals need from a youth entry. */
export type YouthIncome = Pick<YouthEntry, "received_on" | "amount_cents">;

/** What totals need from a church payback. */
export type PaybackIncome = Pick<CafePayback, "received_on" | "amount_cents">;

export type MoneyIn = {
  /** Tithes and events. */
  youth: number;
  /** The cafe's money from Square. */
  cafe: number;
  /** What the church paid back for the cafe's discounts. */
  paybacks: number;
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

/**
 * The money that came in during a period: youth income by the date given,
 * the cafe's money from Square by the week's last day, and church paybacks
 * by the day they arrived. Discounts count once they're paid back, so what's
 * left is money on hand.
 */
export function moneyIn(
  youth: readonly YouthIncome[],
  weeks: readonly CafeSales[],
  paybacks: readonly PaybackIncome[],
  period: Period,
): MoneyIn {
  const { start, end } = periodRange(period);
  const inRange = (date: string) => date >= start && date <= end;
  const youthCents = youth.reduce((total, entry) => (inRange(entry.received_on) ? total + entry.amount_cents : total), 0);
  const cafeCents = weeks.reduce((total, week) => (inRange(week.week_ending) ? total + moneyFromSquare(week) : total), 0);
  const paybackCents = paybacks.reduce(
    (total, payback) => (inRange(payback.received_on) ? total + payback.amount_cents : total),
    0,
  );
  return { youth: youthCents, cafe: cafeCents, paybacks: paybackCents, total: youthCents + cafeCents + paybackCents };
}

function moneyPeriod<P extends Period>(
  youth: readonly YouthIncome[],
  weeks: readonly CafeSales[],
  paybacks: readonly PaybackIncome[],
  paid: PaidPeriod<P>,
): MoneyPeriod<P> {
  const income = moneyIn(youth, weeks, paybacks, paid.period);
  return { period: paid.period, moneyIn: income, paidOut: paid.cents, left: income.total - paid.cents };
}

/**
 * Money in, paid out, and what's left in the month, quarter, and year of the
 * paid totals, plus cafe profit. Profit counts discounts in the week they
 * happened and cafe costs by purchase date, like the Income page, so the two
 * always agree.
 */
export function moneyTotals(
  youth: readonly YouthIncome[],
  weeks: readonly CafeSales[],
  paybacks: readonly PaybackIncome[],
  cafeCosts: readonly CafeCost[],
  paid: PaidTotals,
): MoneyTotals {
  const totals = (kind: PaidKind) => ({
    ...moneyPeriod(youth, weeks, paybacks, paid[kind]),
    cafeProfit: cafeTotalsIn(weeks, cafeCosts, paid[kind].period).profit,
  });
  return { month: totals("month"), quarter: totals("quarter"), year: totals("year") };
}

/** Money in, paid out, and what's left in each of the paid chart's months. */
export function moneyByMonth(
  youth: readonly YouthIncome[],
  weeks: readonly CafeSales[],
  paybacks: readonly PaybackIncome[],
  paidMonths: readonly PaidPeriod<MonthPeriod>[],
): MoneyPeriod<MonthPeriod>[] {
  return paidMonths.map((month) => moneyPeriod(youth, weeks, paybacks, month));
}

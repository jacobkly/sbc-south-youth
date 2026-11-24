import { periodRange, type MonthPeriod, type Period } from "@/lib/dates";
import { cafeTotalsIn, type CafeCost } from "@/lib/income/cafe";
import { earnedIncome, incomeIn, type EarnedIncome, type IncomeSources } from "@/lib/income/earned";
import type { PaidKind, PaidPeriod, PaidTotals, TypeCents } from "./summary";

export type MoneyPeriod<P extends Period = Period> = {
  period: P;
  income: EarnedIncome;
  /** The dashboard's paid total for the period, by the date paid. */
  expenses: number;
  /** Below 0 when more was spent than came in. */
  profit: number;
};

export type MoneyTotal = MoneyPeriod & {
  expensesByType: TypeCents;
  /** Discount paybacks from the church, which income already counts as discounts. */
  paidBack: number;
  cafeProfit: number;
  /** The period before, up to the same point as today. */
  before: { income: number; expenses: number; profit: number };
};

export type MoneyTotals = Record<PaidKind, MoneyTotal>;

function moneyPeriod<P extends Period>(sources: IncomeSources, paid: PaidPeriod<P>): MoneyPeriod<P> {
  const income = earnedIncome(incomeIn(sources, periodRange(paid.period)));
  return { period: paid.period, income, expenses: paid.cents, profit: income.total - paid.cents };
}

/**
 * Income, expenses, and profit in the month, quarter, and year of the paid
 * totals, plus cafe profit. Cafe profit counts cafe costs by purchase date,
 * like the Income page, so the two always agree.
 */
export function moneyTotals(
  sources: IncomeSources,
  cafeCosts: readonly CafeCost[],
  paid: PaidTotals,
  paidBefore: PaidTotals,
): MoneyTotals {
  const totals = (kind: PaidKind): MoneyTotal => {
    const { period, byType } = paid[kind];
    const before = moneyPeriod(sources, paidBefore[kind]);
    const { paybacks } = incomeIn(sources, periodRange(period));
    return {
      ...moneyPeriod(sources, paid[kind]),
      expensesByType: byType,
      paidBack: paybacks.reduce((total, { kind, amount_cents }) => (kind === "discounts" ? total + amount_cents : total), 0),
      cafeProfit: cafeTotalsIn(sources.weeks, cafeCosts, sources.paybacks, period).profit,
      before: { income: before.income.total, expenses: before.expenses, profit: before.profit },
    };
  };
  return { month: totals("month"), quarter: totals("quarter"), year: totals("year") };
}

/** Income, expenses, and profit in each of the paid chart's months. */
export function moneyByMonth(
  sources: IncomeSources,
  paidMonths: readonly PaidPeriod<MonthPeriod>[],
): MoneyPeriod<MonthPeriod>[] {
  return paidMonths.map((month) => moneyPeriod(sources, month));
}

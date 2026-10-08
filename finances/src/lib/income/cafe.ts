import { periodContaining, periodRange, type IsoDate, type MonthPeriod, type Period } from "@/lib/dates";
import type { Tables } from "@/lib/database.types";

export type CafeWeek = Pick<Tables<"cafe_weeks">, "id" | "week_ending" | "sales_cents" | "note">;

/** What totals need from a week. */
export type CafeSales = Pick<CafeWeek, "week_ending" | "sales_cents">;

/** A cafe request Reports counts: approved or paid, by its purchase date. */
export type CafeCost = { purchase_date: IsoDate | null; amount_cents: number | null };

export type CafeTotals = {
  sales: number;
  costs: number;
  /** Below 0 when costs are more than sales. */
  profit: number;
  weeks: number;
  /** A week's sales on average, in whole cents. Null with no weeks. */
  average: number | null;
};

function totals(weeks: readonly CafeSales[], costs: number): CafeTotals {
  const sales = weeks.reduce((total, week) => total + week.sales_cents, 0);
  return {
    sales,
    costs,
    profit: sales - costs,
    weeks: weeks.length,
    average: weeks.length ? Math.round(sales / weeks.length) : null,
  };
}

function costsIn(costs: readonly CafeCost[], period: Period): number {
  const { start, end } = periodRange(period);
  return costs.reduce(
    (total, cost) =>
      cost.purchase_date && cost.purchase_date >= start && cost.purchase_date <= end
        ? total + (cost.amount_cents ?? 0)
        : total,
    0,
  );
}

/**
 * A period's cafe sales, costs, and profit. A week counts in the period it
 * ends in, and a cost in the period it was bought.
 */
export function cafeTotalsIn(weeks: readonly CafeSales[], costs: readonly CafeCost[], period: Period): CafeTotals {
  const { start, end } = periodRange(period);
  const inPeriod = weeks.filter((week) => week.week_ending >= start && week.week_ending <= end);
  return totals(inPeriod, costsIn(costs, period));
}

export type CafeMonthGroup = { period: MonthPeriod; totals: CafeTotals; weeks: CafeWeek[] };

/**
 * Weeks by the month they end in, each with that month's costs and profit.
 * Expects the weeks newest first, and keeps that order. A month with costs
 * but no weeks isn't listed.
 */
export function groupWeeksByMonth(weeks: readonly CafeWeek[], costs: readonly CafeCost[]): CafeMonthGroup[] {
  const groups: { key: string; period: MonthPeriod; weeks: CafeWeek[] }[] = [];
  for (const week of weeks) {
    const key = week.week_ending.slice(0, 7);
    const last = groups.at(-1);
    if (last?.key === key) last.weeks.push(week);
    else groups.push({ key, period: periodContaining("month", week.week_ending) as MonthPeriod, weeks: [week] });
  }
  return groups.map(({ period, weeks: monthWeeks }) => ({
    period,
    totals: totals(monthWeeks, costsIn(costs, period)),
    weeks: monthWeeks,
  }));
}

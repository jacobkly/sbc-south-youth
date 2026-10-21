import { periodContaining, periodRange, type IsoDate, type MonthPeriod, type Period } from "@/lib/dates";
import type { Tables } from "@/lib/database.types";

/** A week's money, line by line as Square's sales summary has it. */
export type CafeLines = Pick<
  Tables<"cafe_weeks">,
  | "sales_cents"
  | "returns_cents"
  | "discounts_cents"
  | "gift_card_sales_cents"
  | "gift_card_redeemed_cents"
  | "taxes_cents"
  | "tips_cents"
  | "fees_cents"
>;

/** A week typed by hand has its gross in `sales_cents` and zeros for the rest. */
export const NO_LINES: CafeLines = {
  sales_cents: 0,
  returns_cents: 0,
  discounts_cents: 0,
  gift_card_sales_cents: 0,
  gift_card_redeemed_cents: 0,
  taxes_cents: 0,
  tips_cents: 0,
  fees_cents: 0,
};

export type CafeWeek = Pick<Tables<"cafe_weeks">, "id" | "week_ending" | "note" | "source"> & CafeLines;

/** What totals need from a week. */
export type CafeSales = Pick<CafeWeek, "week_ending"> & CafeLines;

/** A cafe request Reports counts: approved or paid, by its purchase date. */
export type CafeCost = { purchase_date: IsoDate | null; amount_cents: number | null };

/** A transfer from the church for the discounts of the quarter starting on `quarter_start`. */
export type CafePayback = Pick<Tables<"cafe_paybacks">, "id" | "quarter_start" | "received_on" | "amount_cents" | "note">;

/** Gross sales less returns and discounts. */
export function netSales(lines: CafeLines): number {
  return lines.sales_cents - lines.returns_cents - lines.discounts_cents;
}

/** What Square counts as paid in, less its fees. Includes gift card redemptions. */
export function netTotal(lines: CafeLines): number {
  return netSales(lines) + lines.gift_card_sales_cents + lines.taxes_cents + lines.tips_cents - lines.fees_cents;
}

/**
 * The money the cafe got from Square: card, cash, and Cash App, less fees. A
 * gift card's money came in when it was sold, so paying with one isn't new
 * money. A week typed by hand is all gross.
 */
export function moneyFromSquare(lines: CafeLines): number {
  return netTotal(lines) - lines.gift_card_redeemed_cents;
}

export type CafeTotals = {
  /** Gross sales. */
  sales: number;
  moneyIn: number;
  /** Discounts the church pays back. */
  discounts: number;
  costs: number;
  /** Money in plus discounts less costs. Below 0 when costs are more. */
  profit: number;
  weeks: number;
  /** A week's gross sales on average, in whole cents. Null with no weeks. */
  average: number | null;
};

function totals(weeks: readonly CafeSales[], costs: number): CafeTotals {
  let sales = 0;
  let moneyIn = 0;
  let discounts = 0;
  for (const week of weeks) {
    sales += week.sales_cents;
    moneyIn += moneyFromSquare(week);
    discounts += week.discounts_cents;
  }
  return {
    sales,
    moneyIn,
    discounts,
    costs,
    profit: moneyIn + discounts - costs,
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

/** The first day of a date's calendar quarter. A week goes by its Sunday's quarter. */
export function quarterStartOf(date: IsoDate): IsoDate {
  return periodRange(periodContaining("quarter", date)).start;
}

export type DiscountQuarter = {
  /** The quarter's first day. */
  start: IsoDate;
  /** The discounts of the weeks that end in it. */
  owed: number;
  paid: number;
  /** What the church still owes, 0 once paybacks reach it. */
  left: number;
  paybacks: CafePayback[];
};

/** Each quarter with discounts or a payback, newest first. */
export function discountQuarters(
  weeks: readonly Pick<CafeWeek, "week_ending" | "discounts_cents">[],
  paybacks: readonly CafePayback[],
): DiscountQuarter[] {
  const quarters = new Map<IsoDate, DiscountQuarter>();
  const quarter = (start: IsoDate) => {
    let found = quarters.get(start);
    if (!found) {
      found = { start, owed: 0, paid: 0, left: 0, paybacks: [] };
      quarters.set(start, found);
    }
    return found;
  };

  for (const week of weeks) {
    if (week.discounts_cents > 0) quarter(quarterStartOf(week.week_ending)).owed += week.discounts_cents;
  }
  for (const payback of paybacks) {
    const found = quarter(payback.quarter_start);
    found.paid += payback.amount_cents;
    found.paybacks.push(payback);
  }

  return [...quarters.values()]
    .map((found) => ({ ...found, left: Math.max(found.owed - found.paid, 0) }))
    .sort((a, b) => b.start.localeCompare(a.start));
}

/** The quarters the church still owes for, oldest first. */
export function stillOwed(quarters: readonly DiscountQuarter[]): DiscountQuarter[] {
  return quarters.filter((quarter) => quarter.left > 0).reverse();
}

export type PaybackStatus = "paid" | "partly" | "owed";

/** Where a quarter's discounts stand, and so each of its weeks'. */
export function paybackStatus(quarter: Pick<DiscountQuarter, "paid" | "left">): PaybackStatus {
  return quarter.left === 0 ? "paid" : quarter.paid > 0 ? "partly" : "owed";
}

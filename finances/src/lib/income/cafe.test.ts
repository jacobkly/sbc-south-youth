import { describe, expect, it } from "vitest";
import { cafeTotalsIn, groupWeeksByMonth, type CafeCost, type CafeWeek } from "./cafe";

const OCTOBER = { kind: "month", year: 2026, month: 10 } as const;

let next = 0;

function week(week_ending: string, sales_cents: number): CafeWeek {
  next += 1;
  return { id: `w${next}`, week_ending, sales_cents, note: null };
}

function cost(purchase_date: string, amount_cents: number): CafeCost {
  return { purchase_date, amount_cents };
}

describe("cafeTotalsIn", () => {
  it("has nothing for a month with no weeks or costs", () => {
    expect(cafeTotalsIn([], [], OCTOBER)).toEqual({ sales: 0, costs: 0, profit: 0, weeks: 0, average: null });
  });

  it("counts a week in the month it ends", () => {
    // September 28 to October 4 counts in October, and September 21 to 27 doesn't.
    const totals = cafeTotalsIn([week("2026-10-04", 60000), week("2026-09-27", 50000)], [], OCTOBER);
    expect(totals).toMatchObject({ sales: 60000, weeks: 1 });
  });

  it("takes away the month's cafe costs by purchase date", () => {
    const costs = [cost("2026-10-01", 12000), cost("2026-10-31", 3000), cost("2026-09-30", 99900)];
    expect(cafeTotalsIn([week("2026-10-04", 60000)], costs, OCTOBER)).toMatchObject({
      sales: 60000,
      costs: 15000,
      profit: 45000,
    });
  });

  it("shows a loss when costs are more than sales", () => {
    expect(cafeTotalsIn([week("2026-10-04", 5000)], [cost("2026-10-02", 20000)], OCTOBER).profit).toBe(-15000);
  });

  it("counts a $0 week in the average", () => {
    const totals = cafeTotalsIn([week("2026-10-11", 0), week("2026-10-04", 60001)], [], OCTOBER);
    expect(totals).toMatchObject({ weeks: 2, average: 30001 });
  });

  it("skips costs with no date or amount", () => {
    const costs = [
      { purchase_date: null, amount_cents: 5000 },
      { purchase_date: "2026-10-02", amount_cents: null },
    ];
    expect(cafeTotalsIn([], costs, OCTOBER).costs).toBe(0);
  });

  it("covers a whole quarter or year", () => {
    const weeks = [week("2026-10-04", 60000), week("2026-09-27", 50000), week("2026-07-05", 40000)];
    const costs = [cost("2026-09-29", 15000), cost("2026-07-01", 10000), cost("2026-06-30", 99900)];
    expect(cafeTotalsIn(weeks, costs, { kind: "quarter", year: 2026, quarter: 3 })).toMatchObject({
      sales: 90000,
      costs: 25000,
      profit: 65000,
      weeks: 2,
    });
    expect(cafeTotalsIn(weeks, costs, { kind: "year", year: 2026 })).toMatchObject({ sales: 150000, weeks: 3 });
  });
});

describe("groupWeeksByMonth", () => {
  it("has no months with no weeks", () => {
    expect(groupWeeksByMonth([], [cost("2026-10-02", 1000)])).toEqual([]);
  });

  it("groups weeks newest first by the month they end in, with that month's costs", () => {
    const weeks = [week("2026-10-11", 70000), week("2026-10-04", 60000), week("2026-09-27", 50000)];
    const costs = [cost("2026-10-03", 20000), cost("2026-09-15", 10000), cost("2026-08-20", 40000)];

    const months = groupWeeksByMonth(weeks, costs);

    expect(months.map((month) => month.period)).toEqual([OCTOBER, { kind: "month", year: 2026, month: 9 }]);
    expect(months[0].weeks.map((w) => w.week_ending)).toEqual(["2026-10-11", "2026-10-04"]);
    expect(months[0].totals).toEqual({ sales: 130000, costs: 20000, profit: 110000, weeks: 2, average: 65000 });
    expect(months[1].totals).toEqual({ sales: 50000, costs: 10000, profit: 40000, weeks: 1, average: 50000 });
  });
});

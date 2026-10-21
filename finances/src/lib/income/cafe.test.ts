import { describe, expect, it } from "vitest";
import {
  NO_LINES,
  cafeTotalsIn,
  discountQuarters,
  groupWeeksByMonth,
  moneyFromSquare,
  netSales,
  netTotal,
  paybackStatus,
  quarterStartOf,
  stillOwed,
  type CafeCost,
  type CafeLines,
  type CafePayback,
  type CafeWeek,
} from "./cafe";

const OCTOBER = { kind: "month", year: 2026, month: 10 } as const;

let next = 0;

/** A week typed by hand has only its gross. Pass other lines for a week from Square. */
function week(week_ending: string, sales_cents: number, lines: Partial<CafeLines> = {}): CafeWeek {
  next += 1;
  return { id: `w${next}`, week_ending, note: null, source: "manual", ...NO_LINES, sales_cents, ...lines };
}

function cost(purchase_date: string, amount_cents: number): CafeCost {
  return { purchase_date, amount_cents };
}

function payback(quarter_start: string, amount_cents: number, received_on = "2026-10-15"): CafePayback {
  next += 1;
  return { id: `p${next}`, quarter_start, received_on, amount_cents, note: null };
}

// A made-up Square week with a return and gift cards.
const SQUARE: CafeLines = {
  sales_cents: 50000,
  returns_cents: 1200,
  discounts_cents: 8000,
  gift_card_sales_cents: 5000,
  gift_card_redeemed_cents: 2500,
  taxes_cents: 0,
  tips_cents: 3000,
  fees_cents: 1850,
};

describe("a week's lines", () => {
  it("adds up Square's net sales and net total", () => {
    expect(netSales(SQUARE)).toBe(40800);
    expect(netTotal(SQUARE)).toBe(46950);
  });

  it("leaves gift card redemptions out of the money from Square", () => {
    // The card's $25 came in when it was sold, so only $469.50 - $25.
    expect(moneyFromSquare(SQUARE)).toBe(44450);
  });

  it("counts tips and taxes as money in", () => {
    expect(moneyFromSquare({ ...NO_LINES, sales_cents: 10000, tips_cents: 700, taxes_cents: 300 })).toBe(11000);
  });

  it("treats a week typed by hand as all money in", () => {
    expect(moneyFromSquare({ ...NO_LINES, sales_cents: 60000 })).toBe(60000);
  });
});

describe("cafeTotalsIn", () => {
  it("has nothing for a month with no weeks or costs", () => {
    expect(cafeTotalsIn([], [], OCTOBER)).toEqual({
      sales: 0,
      moneyIn: 0,
      discounts: 0,
      costs: 0,
      profit: 0,
      weeks: 0,
      average: null,
    });
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
      moneyIn: 60000,
      costs: 15000,
      profit: 45000,
    });
  });

  it("adds the church's discounts to the money from Square for profit", () => {
    const weeks = [week("2026-10-11", 50000, SQUARE), week("2026-10-04", 30000)];
    expect(cafeTotalsIn(weeks, [cost("2026-10-06", 10000)], OCTOBER)).toEqual({
      sales: 80000,
      moneyIn: 74450,
      discounts: 8000,
      costs: 10000,
      profit: 72450,
      weeks: 2,
      average: 40000,
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
    expect(months[0].totals).toMatchObject({ sales: 130000, costs: 20000, profit: 110000, weeks: 2, average: 65000 });
    expect(months[1].totals).toMatchObject({ sales: 50000, costs: 10000, profit: 40000, weeks: 1, average: 50000 });
  });
});

describe("quarterStartOf", () => {
  it("gives the first day of a date's calendar quarter", () => {
    expect(quarterStartOf("2026-01-01")).toBe("2026-01-01");
    expect(quarterStartOf("2026-06-30")).toBe("2026-04-01");
    expect(quarterStartOf("2026-08-15")).toBe("2026-07-01");
    expect(quarterStartOf("2026-12-31")).toBe("2026-10-01");
  });
});

describe("discountQuarters", () => {
  it("has nothing with no discounts or paybacks", () => {
    expect(discountQuarters([week("2026-10-04", 60000)], [])).toEqual([]);
  });

  it("owes each quarter the discounts of the weeks that end in it", () => {
    // September 28 to October 4 ends in the fourth quarter.
    const weeks = [
      week("2026-10-11", 0, { discounts_cents: 2000 }),
      week("2026-10-04", 0, { discounts_cents: 3000 }),
      week("2026-09-27", 0, { discounts_cents: 4000 }),
    ];
    expect(discountQuarters(weeks, [])).toEqual([
      { start: "2026-10-01", owed: 5000, paid: 0, left: 5000, paybacks: [] },
      { start: "2026-07-01", owed: 4000, paid: 0, left: 4000, paybacks: [] },
    ]);
  });

  it("takes each quarter's paybacks off what it's owed", () => {
    const short = payback("2026-07-01", 2500);
    const rest = payback("2026-07-01", 1500);
    const weeks = [week("2026-09-27", 0, { discounts_cents: 4000 }), week("2026-08-02", 0, { discounts_cents: 1000 })];

    expect(discountQuarters(weeks, [short])).toEqual([
      { start: "2026-07-01", owed: 5000, paid: 2500, left: 2500, paybacks: [short] },
    ]);
    expect(discountQuarters(weeks, [short, rest])[0]).toMatchObject({ paid: 4000, left: 1000 });
  });

  it("owes nothing once paybacks reach it, even past it", () => {
    const weeks = [week("2026-09-27", 0, { discounts_cents: 4000 })];
    expect(discountQuarters(weeks, [payback("2026-07-01", 4500)])[0]).toMatchObject({ paid: 4500, left: 0 });
  });

  it("lists a quarter with only a payback, newest first", () => {
    const weeks = [week("2026-10-04", 0, { discounts_cents: 3000 })];
    expect(discountQuarters(weeks, [payback("2026-04-01", 1000)]).map((quarter) => quarter.start)).toEqual([
      "2026-10-01",
      "2026-04-01",
    ]);
  });
});

describe("stillOwed", () => {
  it("lists the quarters the church still owes, oldest first", () => {
    const weeks = [
      week("2026-10-04", 0, { discounts_cents: 3000 }),
      week("2026-09-27", 0, { discounts_cents: 4000 }),
      week("2026-06-28", 0, { discounts_cents: 2000 }),
    ];
    const quarters = discountQuarters(weeks, [payback("2026-07-01", 4000), payback("2026-04-01", 500)]);
    expect(stillOwed(quarters).map(({ start, left }) => ({ start, left }))).toEqual([
      { start: "2026-04-01", left: 1500 },
      { start: "2026-10-01", left: 3000 },
    ]);
  });
});

describe("paybackStatus", () => {
  it("is paid once paybacks reach the discounts, partly before that, and owed with none", () => {
    expect(paybackStatus({ paid: 5000, left: 0 })).toBe("paid");
    expect(paybackStatus({ paid: 6000, left: 0 })).toBe("paid");
    expect(paybackStatus({ paid: 1000, left: 4000 })).toBe("partly");
    expect(paybackStatus({ paid: 0, left: 5000 })).toBe("owed");
  });
});

import { describe, expect, it } from "vitest";
import { NO_LINES } from "@/lib/income/cafe";
import { moneyByMonth, moneyTotals } from "./money";
import { paidBefore, paidByMonth, paidTotals } from "./summary";

const TODAY = "2026-10-05";

const youth = [
  { received_on: "2026-10-04", amount_cents: 4000 }, // month, quarter, year
  { received_on: "2026-10-01", amount_cents: 34000 }, // month, quarter, year
  { received_on: "2026-09-30", amount_cents: 2500 }, // year
  { received_on: "2025-12-31", amount_cents: 9900 }, // last year
];

// Each week's money from Square is $650, $500, and $300.
const weeks = [
  // September 28 to October 4 counts in October. $700 gross, less $50 of discounts, plus $10 of tips, less $10 of fees.
  { week_ending: "2026-10-04", ...NO_LINES, sales_cents: 70000, discounts_cents: 5000, tips_cents: 1000, fees_cents: 1000 },
  { week_ending: "2026-09-27", ...NO_LINES, sales_cents: 50000 }, // September, typed by hand
  // December 29 to January 4 counts in January. A $20 gift card paid for some of it, which came in when it was sold.
  { week_ending: "2026-01-04", ...NO_LINES, sales_cents: 32000, gift_card_redeemed_cents: 2000 },
];

// The church paid back the third quarter's discounts in October.
const paybacks = [{ kind: "discounts" as const, received_on: "2026-10-02", amount_cents: 4000 }];

const sources = { youth, weeks, paybacks };

const paid = [
  { paid_date: "2026-10-02", amount_cents: 20000, type: "cafe" as const },
  { paid_date: "2026-10-03", amount_cents: 10000, type: "youth" as const },
  { paid_date: "2026-08-15", amount_cents: 7000, type: "youth" as const },
];

const cafeCosts = [
  { purchase_date: "2026-09-29", amount_cents: 15000 }, // bought in September, paid in October
  { purchase_date: "2026-10-03", amount_cents: 5000 },
];

function totalsFor(income: Parameters<typeof moneyTotals>[0], rows = paid) {
  return moneyTotals(income, cafeCosts, paidTotals(rows, TODAY), paidBefore(rows, TODAY));
}

describe("moneyTotals", () => {
  const totals = totalsFor(sources);

  it("has income, expenses, and profit for each period that contains today", () => {
    expect(totals.month).toMatchObject({
      period: { kind: "month", year: 2026, month: 10 },
      income: { youth: 38000, square: 65000, discounts: 5000, giftCards: 0, cafe: 70000, total: 108000 },
      expenses: 30000,
      profit: 78000,
    });
    expect(totals.quarter).toMatchObject({
      period: { kind: "quarter", year: 2026, quarter: 4 },
      income: { total: 108000 },
      expenses: 30000,
      profit: 78000,
    });
    expect(totals.year).toMatchObject({
      period: { kind: "year", year: 2026 },
      income: { youth: 40500, square: 145000, discounts: 5000, cafe: 150000, total: 190500 },
      expenses: 37000,
      profit: 153500,
    });
  });

  it("splits expenses by type", () => {
    expect(totals.month.expensesByType).toEqual({ cafe: 20000, youth: 10000 });
    expect(totals.year.expensesByType).toEqual({ cafe: 20000, youth: 17000 });
  });

  it("leaves discount paybacks out of income, since the discounts already count", () => {
    expect(totals.month.paidBack).toBe(4000);
    expect(totalsFor({ ...sources, paybacks: [] }).month).toMatchObject({ income: { total: 108000 }, paidBack: 0 });
  });

  it("works out cafe profit like the Income page, with cafe costs by purchase date", () => {
    expect(totals.month.cafeProfit).toBe(65000);
    expect(totals.year.cafeProfit).toBe(130000);
  });

  it("counts the church's gift card money on the day it came in", () => {
    const cards = { kind: "gift_cards" as const, received_on: "2026-10-03", amount_cents: 25000 };
    expect(totalsFor({ ...sources, paybacks: [...paybacks, cards] }).month).toMatchObject({
      income: { giftCards: 25000, cafe: 95000, total: 133000 },
      profit: 103000,
      paidBack: 4000,
      cafeProfit: 90000,
    });
  });

  it("goes below zero when more was spent than came in", () => {
    expect(totalsFor({ youth: [], weeks: [], paybacks: [] }).month).toMatchObject({
      income: { total: 0 },
      expenses: 30000,
      profit: -30000,
      cafeProfit: -5000,
    });
  });

  it("compares with the period before, up to the same point", () => {
    const earlier = {
      youth: [
        ...youth,
        { received_on: "2026-09-05", amount_cents: 700 }, // same point last month
        { received_on: "2026-09-06", amount_cents: 90 }, // past it
        { received_on: "2026-07-05", amount_cents: 300 }, // same point last quarter
        { received_on: "2025-03-02", amount_cents: 1100 }, // same point last year
      ],
      weeks,
      paybacks,
    };
    const rows = [...paid, { paid_date: "2026-09-02", amount_cents: 1000, type: "cafe" as const }];
    const compared = totalsFor(earlier, rows);
    expect(compared.month.before).toEqual({ income: 700, expenses: 1000, profit: -300 });
    expect(compared.quarter.before).toEqual({ income: 300, expenses: 0, profit: 300 });
    expect(compared.year.before).toEqual({ income: 1100, expenses: 0, profit: 1100 });
  });
});

describe("moneyByMonth", () => {
  const months = moneyByMonth(sources, paidByMonth(paid, TODAY));

  it("keeps the chart's 12 months, oldest first", () => {
    expect(months).toHaveLength(12);
    expect(months[0].period).toEqual({ kind: "month", year: 2025, month: 11 });
    expect(months[11].period).toEqual({ kind: "month", year: 2026, month: 10 });
  });

  it("has each month's income, expenses, and profit, empty months included", () => {
    expect(months[11]).toMatchObject({ income: { total: 108000 }, expenses: 30000, profit: 78000 });
    expect(months[10]).toMatchObject({ income: { youth: 2500, square: 50000 }, expenses: 0, profit: 52500 });
    expect(months[9]).toMatchObject({ income: { total: 0 }, expenses: 7000, profit: -7000 });
    expect(months[2]).toMatchObject({ income: { square: 30000 } });
    expect(months[1]).toMatchObject({ income: { total: 9900 }, expenses: 0 });
    expect(months[0]).toMatchObject({ income: { total: 0 }, expenses: 0, profit: 0 });
  });
});

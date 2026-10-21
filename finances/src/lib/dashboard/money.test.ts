import { describe, expect, it } from "vitest";
import { NO_LINES } from "@/lib/income/cafe";
import { moneyByMonth, moneyIn, moneyTotals } from "./money";
import { paidByMonth, paidTotals } from "./summary";

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

const paid = [
  { paid_date: "2026-10-02", amount_cents: 20000, type: "cafe" as const },
  { paid_date: "2026-10-03", amount_cents: 10000, type: "youth" as const },
  { paid_date: "2026-08-15", amount_cents: 7000, type: "youth" as const },
];

const cafeCosts = [
  { purchase_date: "2026-09-29", amount_cents: 15000 }, // bought in September, paid in October
  { purchase_date: "2026-10-03", amount_cents: 5000 },
];

describe("moneyIn", () => {
  it("counts youth income by the date given, a cafe week's money from Square in the month it ends, and a payback the day it came in", () => {
    expect(moneyIn(youth, weeks, paybacks, { kind: "month", year: 2026, month: 10 })).toEqual({
      youth: 38000,
      cafe: 65000,
      paybacks: 4000,
      total: 107000,
    });
    expect(moneyIn(youth, weeks, paybacks, { kind: "month", year: 2026, month: 9 })).toEqual({
      youth: 2500,
      cafe: 50000,
      paybacks: 0,
      total: 52500,
    });
  });

  it("is zero with nothing in", () => {
    expect(moneyIn([], [], [], { kind: "year", year: 2026 })).toEqual({ youth: 0, cafe: 0, paybacks: 0, total: 0 });
  });
});

describe("moneyTotals", () => {
  const totals = moneyTotals(youth, weeks, paybacks, cafeCosts, paidTotals(paid, TODAY));

  it("takes what was paid out from what came in, for each period that contains today", () => {
    expect(totals.month).toMatchObject({
      period: { kind: "month", year: 2026, month: 10 },
      moneyIn: { youth: 38000, cafe: 65000, paybacks: 4000, total: 107000 },
      paidOut: 30000,
      left: 77000,
    });
    expect(totals.quarter).toMatchObject({
      period: { kind: "quarter", year: 2026, quarter: 4 },
      moneyIn: { total: 107000 },
      paidOut: 30000,
      left: 77000,
    });
    expect(totals.year).toMatchObject({
      period: { kind: "year", year: 2026 },
      moneyIn: { youth: 40500, cafe: 145000, paybacks: 4000, total: 189500 },
      paidOut: 37000,
      left: 152500,
    });
  });

  it("works out cafe profit like the Income page, with discounts and cafe costs by purchase date", () => {
    expect(totals.month.cafeProfit).toBe(65000);
    expect(totals.year.cafeProfit).toBe(130000);
  });

  it("counts the church's gift card money as money in and cafe profit, on the day it came in", () => {
    const withCards = [...paybacks, { kind: "gift_cards" as const, received_on: "2026-10-03", amount_cents: 25000 }];
    const cards = moneyTotals(youth, weeks, withCards, cafeCosts, paidTotals(paid, TODAY));
    expect(cards.month).toMatchObject({ moneyIn: { paybacks: 29000, total: 132000 }, cafeProfit: 90000 });
  });

  it("goes below zero when more was paid out than came in", () => {
    const noIncome = moneyTotals([], [], [], cafeCosts, paidTotals(paid, TODAY));
    expect(noIncome.month).toMatchObject({ moneyIn: { total: 0 }, paidOut: 30000, left: -30000, cafeProfit: -5000 });
  });
});

describe("moneyByMonth", () => {
  const months = moneyByMonth(youth, weeks, paybacks, paidByMonth(paid, TODAY));

  it("keeps the chart's 12 months, oldest first", () => {
    expect(months).toHaveLength(12);
    expect(months[0].period).toEqual({ kind: "month", year: 2025, month: 11 });
    expect(months[11].period).toEqual({ kind: "month", year: 2026, month: 10 });
  });

  it("has each month's money in, paid out, and what's left, empty months included", () => {
    expect(months[11]).toMatchObject({ moneyIn: { total: 107000 }, paidOut: 30000, left: 77000 });
    expect(months[10]).toMatchObject({ moneyIn: { youth: 2500, cafe: 50000 }, paidOut: 0, left: 52500 });
    expect(months[9]).toMatchObject({ moneyIn: { total: 0 }, paidOut: 7000, left: -7000 });
    expect(months[2]).toMatchObject({ moneyIn: { cafe: 30000 } });
    expect(months[1]).toMatchObject({ moneyIn: { total: 9900 }, paidOut: 0 });
    expect(months[0]).toMatchObject({ moneyIn: { total: 0 }, paidOut: 0, left: 0 });
  });
});

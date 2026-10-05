import { describe, expect, it } from "vitest";
import { moneyByMonth, moneyIn, moneyTotals } from "./money";
import { paidByMonth, paidTotals } from "./summary";

const TODAY = "2026-10-05";

const youth = [
  { received_on: "2026-10-04", amount_cents: 4000 }, // month, quarter, year
  { received_on: "2026-10-01", amount_cents: 34000 }, // month, quarter, year
  { received_on: "2026-09-30", amount_cents: 2500 }, // year
  { received_on: "2025-12-31", amount_cents: 9900 }, // last year
];

const weeks = [
  { week_ending: "2026-10-04", sales_cents: 65000 }, // September 28 to October 4 counts in October
  { week_ending: "2026-09-27", sales_cents: 50000 }, // September
  { week_ending: "2026-01-04", sales_cents: 30000 }, // December 29 to January 4 counts in January
];

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
  it("counts youth income by the date given and a cafe week in the month it ends", () => {
    expect(moneyIn(youth, weeks, { kind: "month", year: 2026, month: 10 })).toEqual({
      youth: 38000,
      cafe: 65000,
      total: 103000,
    });
    expect(moneyIn(youth, weeks, { kind: "month", year: 2026, month: 9 })).toEqual({
      youth: 2500,
      cafe: 50000,
      total: 52500,
    });
  });

  it("is zero with nothing in", () => {
    expect(moneyIn([], [], { kind: "year", year: 2026 })).toEqual({ youth: 0, cafe: 0, total: 0 });
  });
});

describe("moneyTotals", () => {
  const totals = moneyTotals(youth, weeks, cafeCosts, paidTotals(paid, TODAY));

  it("takes what was paid out from what came in, for each period that contains today", () => {
    expect(totals.month).toMatchObject({
      period: { kind: "month", year: 2026, month: 10 },
      moneyIn: { youth: 38000, cafe: 65000, total: 103000 },
      paidOut: 30000,
      left: 73000,
    });
    expect(totals.quarter).toMatchObject({
      period: { kind: "quarter", year: 2026, quarter: 4 },
      moneyIn: { total: 103000 },
      paidOut: 30000,
      left: 73000,
    });
    expect(totals.year).toMatchObject({
      period: { kind: "year", year: 2026 },
      moneyIn: { youth: 40500, cafe: 145000, total: 185500 },
      paidOut: 37000,
      left: 148500,
    });
  });

  it("works out cafe profit like the Income page, with cafe costs by purchase date", () => {
    expect(totals.month.cafeProfit).toBe(60000);
    expect(totals.year.cafeProfit).toBe(125000);
  });

  it("goes below zero when more was paid out than came in", () => {
    const noIncome = moneyTotals([], [], cafeCosts, paidTotals(paid, TODAY));
    expect(noIncome.month).toMatchObject({ moneyIn: { total: 0 }, paidOut: 30000, left: -30000, cafeProfit: -5000 });
  });
});

describe("moneyByMonth", () => {
  const months = moneyByMonth(youth, weeks, paidByMonth(paid, TODAY));

  it("keeps the chart's 12 months, oldest first", () => {
    expect(months).toHaveLength(12);
    expect(months[0].period).toEqual({ kind: "month", year: 2025, month: 11 });
    expect(months[11].period).toEqual({ kind: "month", year: 2026, month: 10 });
  });

  it("has each month's money in, paid out, and what's left, empty months included", () => {
    expect(months[11]).toMatchObject({ moneyIn: { total: 103000 }, paidOut: 30000, left: 73000 });
    expect(months[10]).toMatchObject({ moneyIn: { youth: 2500, cafe: 50000 }, paidOut: 0, left: 52500 });
    expect(months[9]).toMatchObject({ moneyIn: { total: 0 }, paidOut: 7000, left: -7000 });
    expect(months[2]).toMatchObject({ moneyIn: { cafe: 30000 } });
    expect(months[1]).toMatchObject({ moneyIn: { total: 9900 }, paidOut: 0 });
    expect(months[0]).toMatchObject({ moneyIn: { total: 0 }, paidOut: 0, left: 0 });
  });
});

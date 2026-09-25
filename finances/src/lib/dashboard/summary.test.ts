import { describe, expect, it } from "vitest";
import { paidTotals } from "./summary";

describe("paidTotals", () => {
  const rows = [
    { paid_date: "2026-09-01", amount_cents: 100 }, // month, quarter, year
    { paid_date: "2026-09-25", amount_cents: 200 }, // month, quarter, year
    { paid_date: "2026-08-31", amount_cents: 400 }, // quarter, year
    { paid_date: "2026-07-01", amount_cents: 800 }, // quarter, year
    { paid_date: "2026-06-30", amount_cents: 1600 }, // year
    { paid_date: "2026-01-01", amount_cents: 3200 }, // year
    { paid_date: "2025-12-31", amount_cents: 6400 }, // none
    { paid_date: null, amount_cents: 12800 }, // not paid
  ];

  it("sums each period that contains today, edges included", () => {
    const totals = paidTotals(rows, "2026-09-25");
    expect(totals.month).toEqual({ period: { kind: "month", year: 2026, month: 9 }, cents: 300 });
    expect(totals.quarter).toEqual({ period: { kind: "quarter", year: 2026, quarter: 3 }, cents: 1500 });
    expect(totals.year).toEqual({ period: { kind: "year", year: 2026 }, cents: 6300 });
  });

  it("starts fresh on the first day of a year", () => {
    const totals = paidTotals(rows, "2026-01-01");
    expect(totals.month.cents).toBe(3200);
    expect(totals.quarter.cents).toBe(3200);
    expect(totals.year.cents).toBe(6300);
  });

  it("is zero with no paid requests", () => {
    const totals = paidTotals([], "2026-09-25");
    expect([totals.month.cents, totals.quarter.cents, totals.year.cents]).toEqual([0, 0, 0]);
  });
});

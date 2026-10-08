import { describe, expect, it } from "vitest";
import type { CafeWeek } from "@/lib/income/cafe";
import type { YouthEntry } from "@/lib/income/stats";
import { incomeTotals, titheMonths, type OutRow } from "./income";

function youth(
  received_on: string,
  amount_cents: number,
  kind: YouthEntry["kind"] = "tithe",
  method: YouthEntry["method"] = "cash",
): YouthEntry {
  return { id: `${received_on}-${amount_cents}`, kind, received_on, amount_cents, method, event_name: null };
}

function week(week_ending: string, sales_cents: number): CafeWeek {
  return { id: week_ending, week_ending, sales_cents, note: null };
}

function out(type: OutRow["type"], amount_cents: number, status: OutRow["status"] = "paid"): OutRow {
  return { type, amount_cents, status };
}

describe("incomeTotals", () => {
  it("adds up money in, what went out, what's left, and each type's profit", () => {
    const totals = incomeTotals(
      {
        youth: [youth("2026-09-06", 2000), youth("2026-09-13", 5000, "event", null)],
        weeks: [week("2026-09-06", 30000), week("2026-09-13", 25000)],
      },
      [out("cafe", 12000), out("cafe", 3000, "approved"), out("youth", 4500)],
    );
    expect(totals).toEqual({
      moneyIn: { youth: 7000, cafe: 55000, total: 62000 },
      out: { youth: 4500, cafe: 15000, total: 19500, count: 3 },
      left: 42500,
      profit: { cafe: 40000, youth: 2500 },
    });
  });

  it("counts only approved and paid requests as out, so All statuses doesn't add what wasn't spent", () => {
    const totals = incomeTotals({ youth: [youth("2026-09-06", 1000)], weeks: [] }, [
      out("youth", 400, "approved"),
      out("youth", 200, "paid"),
      out("youth", 10000, "draft"),
      out("youth", 10000, "submitted"),
      out("youth", 10000, "needs_info"),
      out("youth", 10000, "rejected"),
      out("cafe", 10000, "cancelled"),
    ]);
    expect(totals.out).toEqual({ youth: 600, cafe: 0, total: 600, count: 2 });
    expect(totals.left).toBe(400);
  });

  it("goes below zero when more went out than came in", () => {
    const totals = incomeTotals({ youth: [], weeks: [week("2026-09-06", 1000)] }, [out("cafe", 4750)]);
    expect(totals.left).toBe(-3750);
    expect(totals.profit).toEqual({ cafe: -3750, youth: 0 });
  });

  it("is all zeros with nothing in or out", () => {
    expect(incomeTotals({ youth: [], weeks: [] }, [])).toEqual({
      moneyIn: { youth: 0, cafe: 0, total: 0 },
      out: { youth: 0, cafe: 0, total: 0, count: 0 },
      left: 0,
      profit: { cafe: 0, youth: 0 },
    });
  });
});

describe("titheMonths", () => {
  it("lists every month of a quarter, oldest first, with only its tithes", () => {
    const entries = [
      youth("2026-07-05", 1000),
      youth("2026-07-19", 2500),
      youth("2026-07-26", 9000, "event", null),
      youth("2026-09-13", 1500),
    ];
    expect(titheMonths(entries, { kind: "quarter", year: 2026, quarter: 3 })).toEqual([
      { period: { kind: "month", year: 2026, month: 7 }, count: 2, total: 3500, average: 1750 },
      { period: { kind: "month", year: 2026, month: 8 }, count: 0, total: 0, average: null },
      { period: { kind: "month", year: 2026, month: 9 }, count: 1, total: 1500, average: 1500 },
    ]);
  });

  it("has one month for a month", () => {
    expect(titheMonths([youth("2026-09-13", 1500)], { kind: "month", year: 2026, month: 9 })).toEqual([
      { period: { kind: "month", year: 2026, month: 9 }, count: 1, total: 1500, average: 1500 },
    ]);
  });

  it("lists each month a custom range touches and leaves out tithes outside it", () => {
    const entries = [youth("2026-03-14", 700), youth("2026-03-15", 1000), youth("2026-04-02", 333), youth("2026-04-03", 900)];
    expect(titheMonths(entries, { kind: "custom", start: "2026-03-15", end: "2026-04-02" })).toEqual([
      { period: { kind: "month", year: 2026, month: 3 }, count: 1, total: 1000, average: 1000 },
      { period: { kind: "month", year: 2026, month: 4 }, count: 1, total: 333, average: 333 },
    ]);
  });

  it("crosses into the next year", () => {
    const months = titheMonths([], { kind: "custom", start: "2025-12-20", end: "2026-01-10" });
    expect(months.map((month) => month.period)).toEqual([
      { kind: "month", year: 2025, month: 12 },
      { kind: "month", year: 2026, month: 1 },
    ]);
  });

  it("rounds a month's average to whole cents", () => {
    const [month] = titheMonths([youth("2026-09-06", 1000), youth("2026-09-13", 1001), youth("2026-09-20", 1001)], {
      kind: "month",
      year: 2026,
      month: 9,
    });
    expect(month.average).toBe(1001);
  });
});

import { describe, expect, it } from "vitest";
import { NO_LINES, type CafeLines, type CafePayback, type CafeWeek } from "@/lib/income/cafe";
import type { YouthEntry } from "@/lib/income/stats";
import type { RequestStatus } from "@/lib/requests/format";
import type { ReportIncome } from "./income";
import { profitTimeline } from "./profit";

function youth(received_on: string, amount_cents: number): YouthEntry {
  return { id: received_on, kind: "tithe", received_on, amount_cents, method: "cash", event_name: null };
}

function week(week_ending: string, sales_cents: number, lines: Partial<CafeLines> = {}): CafeWeek {
  return { id: week_ending, week_ending, ...NO_LINES, sales_cents, ...lines, source: "square", note: null };
}

function payback(received_on: string, amount_cents: number, kind: CafePayback["kind"]): CafePayback {
  return { id: received_on, kind, quarter_start: "2026-07-01", received_on, amount_cents, note: null };
}

function request(purchase_date: string, amount_cents: number, status: RequestStatus = "paid", paid_at: string | null = null) {
  return { type: "cafe" as const, amount_cents, purchase_date, paid_at, status };
}

const NONE: ReportIncome = { youth: [], weeks: [], paybacks: [] };
const YEAR = { start: "2026-01-01", end: "2026-12-31" };

describe("profitTimeline", () => {
  it("puts income and expenses in the buckets they fall in, with each one's profit", () => {
    const { unit, buckets } = profitTimeline(
      {
        youth: [youth("2026-01-04", 5000)],
        weeks: [week("2026-01-04", 30000, { discounts_cents: 2000 }), week("2026-03-01", 10000)],
        paybacks: [payback("2026-03-15", 25000, "gift_cards"), payback("2026-03-20", 9999, "discounts")],
      },
      [request("2026-01-31", 12000), request("2026-02-10", 4000)],
      YEAR,
      "purchase",
    );
    expect(unit).toBe("month");
    expect(buckets).toHaveLength(12);
    // A discount counts in its week, and paying it back isn't income again.
    expect(buckets[0]).toEqual({ start: "2026-01-01", end: "2026-01-31", income: 35000, expenses: 12000, profit: 23000 });
    expect(buckets[1]).toMatchObject({ income: 0, expenses: 4000, profit: -4000 });
    expect(buckets[2]).toMatchObject({ income: 35000, expenses: 0, profit: 35000 });
    expect(buckets[3]).toMatchObject({ income: 0, expenses: 0, profit: 0 });
  });

  it("counts requests by the LA date paid when the report does", () => {
    const { buckets } = profitTimeline(
      NONE,
      [request("2026-01-31", 12000, "paid", "2026-03-01T07:30:00Z"), request("2026-01-31", 500, "approved")],
      YEAR,
      "paid",
    );
    expect(buckets[0].expenses).toBe(0);
    expect(buckets[1].expenses).toBe(12000);
  });

  it("leaves out requests that weren't approved or paid", () => {
    const { buckets } = profitTimeline(
      NONE,
      [request("2026-01-05", 100, "approved"), request("2026-01-05", 9000, "submitted"), request("2026-01-05", 9000, "draft")],
      YEAR,
      "purchase",
    );
    expect(buckets[0].expenses).toBe(100);
  });

  it("starts years at the first one with income or expenses", () => {
    const { unit, buckets } = profitTimeline(
      { ...NONE, weeks: [week("2020-10-11", 1000)] },
      [request("2023-01-05", 400)],
      { start: "2015-01-01", end: "2026-12-31" },
      "purchase",
    );
    expect(unit).toBe("year");
    expect(buckets.map((bucket) => bucket.start.slice(0, 4))).toEqual(["2020", "2021", "2022", "2023", "2024", "2025", "2026"]);
  });
});

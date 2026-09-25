import { describe, expect, it } from "vitest";
import {
  canStepForward,
  customPeriod,
  parsePeriodSlug,
  parseReportFilters,
  periodSlug,
  reportBounds,
  reportExportHref,
  reportHref,
  reportTotals,
  switchPeriodKind,
} from "./filters";

const TODAY = "2026-09-25";

describe("period slugs", () => {
  it("round-trips every kind", () => {
    for (const slug of ["2026", "2026-Q3", "2026-09", "2026-03-15_to_2026-04-02"]) {
      expect(periodSlug(parsePeriodSlug(slug)!)).toBe(slug);
    }
  });

  it("reads each kind", () => {
    expect(parsePeriodSlug("2026-Q3")).toEqual({ kind: "quarter", year: 2026, quarter: 3 });
    expect(parsePeriodSlug("2026-q3")).toEqual({ kind: "quarter", year: 2026, quarter: 3 });
    expect(parsePeriodSlug("2026-01")).toEqual({ kind: "month", year: 2026, month: 1 });
    expect(parsePeriodSlug("2026")).toEqual({ kind: "year", year: 2026 });
    expect(parsePeriodSlug("2026-03-15_to_2026-03-15")).toEqual({
      kind: "custom",
      start: "2026-03-15",
      end: "2026-03-15",
    });
  });

  it("rejects anything else", () => {
    for (const slug of [
      "",
      "Q3",
      "2026-Q5",
      "2026-13",
      "2026-9",
      "0000",
      "26",
      "2026-04-02_to_2026-03-15",
      "2026-02-30_to_2026-03-15",
      "0001-01-01_to_2026-01-01",
    ]) {
      expect(parsePeriodSlug(slug)).toBeNull();
    }
  });
});

describe("customPeriod", () => {
  it("needs two real dates in order", () => {
    expect(customPeriod("2026-07-01", "2026-09-30")).toEqual({ kind: "custom", start: "2026-07-01", end: "2026-09-30" });
    expect(customPeriod("2026-09-30", "2026-07-01")).toBeNull();
    expect(customPeriod("", "2026-07-01")).toBeNull();
    expect(customPeriod("0002-07-01", "2026-07-01")).toBeNull();
  });
});

describe("parseReportFilters", () => {
  it("defaults to this quarter, by purchase date, approved and paid", () => {
    expect(parseReportFilters({}, TODAY)).toEqual({
      period: { kind: "quarter", year: 2026, quarter: 3 },
      basis: "purchase",
      allStatuses: false,
    });
  });

  it("reads the period, basis, and status", () => {
    expect(parseReportFilters({ period: "2025-11", basis: "paid", status: "all" }, TODAY)).toEqual({
      period: { kind: "month", year: 2025, month: 11 },
      basis: "paid",
      allStatuses: true,
    });
  });

  it("falls back to the defaults for anything unrecognized", () => {
    expect(parseReportFilters({ period: "soon", basis: "vibes", status: "some" }, TODAY)).toEqual(
      parseReportFilters({}, TODAY),
    );
    expect(parseReportFilters({ period: ["2025", "2024"] }, TODAY).period).toEqual({ kind: "year", year: 2025 });
  });

  it("round-trips through the URL", () => {
    const filters = parseReportFilters({ period: "2026-03-15_to_2026-04-02", basis: "paid" }, TODAY);
    const params = Object.fromEntries(new URL(reportHref(filters), "http://x").searchParams);
    expect(parseReportFilters(params, TODAY)).toEqual(filters);
    expect(reportHref(parseReportFilters({}, TODAY))).toBe("/admin/reports?period=2026-Q3");
  });

  it("exports the same report", () => {
    const filters = parseReportFilters({ period: "2026-09", status: "all" }, TODAY);
    expect(reportExportHref(filters)).toBe("/admin/reports/export?period=2026-09&status=all");
  });
});

describe("reportBounds", () => {
  const q3 = { kind: "quarter", year: 2026, quarter: 3 } as const;

  it("covers the purchase dates in the period, approved and paid by default", () => {
    expect(reportBounds({ period: q3, basis: "purchase", allStatuses: false })).toEqual({
      column: "purchase_date",
      from: "2026-07-01",
      before: "2026-10-01",
      statuses: ["approved", "paid"],
    });
    expect(reportBounds({ period: q3, basis: "purchase", allStatuses: true }).statuses).toBeNull();
  });

  it("covers the LA days of the period for paid dates, paid requests only", () => {
    expect(reportBounds({ period: q3, basis: "paid", allStatuses: true })).toEqual({
      column: "paid_at",
      from: "2026-07-01T07:00:00.000Z",
      before: "2026-10-01T07:00:00.000Z",
      statuses: ["paid"],
    });
  });

  it("follows daylight saving time across the period", () => {
    const q4 = reportBounds({ period: { kind: "quarter", year: 2026, quarter: 4 }, basis: "paid", allStatuses: false });
    expect(q4.from).toBe("2026-10-01T07:00:00.000Z");
    expect(q4.before).toBe("2027-01-01T08:00:00.000Z");
  });
});

describe("switchPeriodKind", () => {
  it("keeps the current period's last day in view", () => {
    expect(switchPeriodKind({ kind: "year", year: 2025 }, "quarter", TODAY)).toEqual({
      kind: "quarter",
      year: 2025,
      quarter: 4,
    });
    expect(switchPeriodKind({ kind: "month", year: 2026, month: 2 }, "quarter", TODAY)).toEqual({
      kind: "quarter",
      year: 2026,
      quarter: 1,
    });
  });

  it("uses today when the period hasn't ended", () => {
    expect(switchPeriodKind({ kind: "quarter", year: 2026, quarter: 3 }, "month", TODAY)).toEqual({
      kind: "month",
      year: 2026,
      month: 9,
    });
    expect(switchPeriodKind({ kind: "year", year: 2026 }, "month", TODAY)).toEqual({ kind: "month", year: 2026, month: 9 });
  });

  it("turns a period into the same dates for a custom range", () => {
    expect(switchPeriodKind({ kind: "quarter", year: 2026, quarter: 2 }, "custom", TODAY)).toEqual({
      kind: "custom",
      start: "2026-04-01",
      end: "2026-06-30",
    });
    expect(
      switchPeriodKind({ kind: "custom", start: "2025-12-20", end: "2026-01-10" }, "month", TODAY),
    ).toEqual({ kind: "month", year: 2026, month: 1 });
  });
});

describe("canStepForward", () => {
  it("stops at the period holding today", () => {
    expect(canStepForward({ kind: "quarter", year: 2026, quarter: 3 }, TODAY)).toBe(false);
    expect(canStepForward({ kind: "quarter", year: 2026, quarter: 2 }, TODAY)).toBe(true);
    expect(canStepForward({ kind: "month", year: 2026, month: 8 }, TODAY)).toBe(true);
    expect(canStepForward({ kind: "year", year: 2026 }, TODAY)).toBe(false);
  });

  it("allows the next period on its first day", () => {
    expect(canStepForward({ kind: "month", year: 2026, month: 9 }, "2026-10-01")).toBe(true);
  });
});

describe("reportTotals", () => {
  it("adds up amounts and counts by type", () => {
    expect(
      reportTotals([
        { type: "cafe", amount_cents: 1250 },
        { type: "youth", amount_cents: 4000 },
        { type: "cafe", amount_cents: 99 },
      ]),
    ).toEqual({
      cents: 5349,
      count: 3,
      byType: { cafe: { cents: 1349, count: 2 }, youth: { cents: 4000, count: 1 } },
    });
  });

  it("is zero for no requests", () => {
    expect(reportTotals([])).toEqual({
      cents: 0,
      count: 0,
      byType: { cafe: { cents: 0, count: 0 }, youth: { cents: 0, count: 0 } },
    });
  });
});

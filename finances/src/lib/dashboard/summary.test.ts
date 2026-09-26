import { describe, expect, it } from "vitest";
import {
  paidBefore,
  paidByMonth,
  paidTotals,
  samePointBefore,
  sharePercent,
  statusTotal,
  topPayees,
  trend,
} from "./summary";

describe("paidTotals", () => {
  const rows = [
    { paid_date: "2026-09-01", amount_cents: 100, type: "cafe" as const }, // month, quarter, year
    { paid_date: "2026-09-25", amount_cents: 200, type: "youth" as const }, // month, quarter, year
    { paid_date: "2026-08-31", amount_cents: 400, type: "cafe" as const }, // quarter, year
    { paid_date: "2026-07-01", amount_cents: 800, type: "youth" as const }, // quarter, year
    { paid_date: "2026-06-30", amount_cents: 1600, type: "cafe" as const }, // year
    { paid_date: "2026-01-01", amount_cents: 3200, type: "youth" as const }, // year
    { paid_date: "2025-12-31", amount_cents: 6400, type: "cafe" as const }, // none
    { paid_date: null, amount_cents: 12800, type: "cafe" as const }, // not paid
  ];

  it("sums each period that contains today, edges included", () => {
    const totals = paidTotals(rows, "2026-09-25");
    expect(totals.month).toEqual({
      period: { kind: "month", year: 2026, month: 9 },
      cents: 300,
      byType: { cafe: 100, youth: 200 },
    });
    expect(totals.quarter).toEqual({
      period: { kind: "quarter", year: 2026, quarter: 3 },
      cents: 1500,
      byType: { cafe: 500, youth: 1000 },
    });
    expect(totals.year).toEqual({
      period: { kind: "year", year: 2026 },
      cents: 6300,
      byType: { cafe: 2100, youth: 4200 },
    });
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
    expect(totals.year.byType).toEqual({ cafe: 0, youth: 0 });
  });
});

describe("paidByMonth", () => {
  const rows = [
    { paid_date: "2026-09-30", amount_cents: 100, type: "cafe" as const },
    { paid_date: "2026-09-01", amount_cents: 200, type: "youth" as const },
    { paid_date: "2026-01-15", amount_cents: 400, type: "youth" as const },
    { paid_date: "2025-10-01", amount_cents: 800, type: "cafe" as const }, // first month shown
    { paid_date: "2025-09-30", amount_cents: 1600, type: "cafe" as const }, // too old
  ];

  it("returns 12 months, oldest first, ending with this month", () => {
    const months = paidByMonth(rows, "2026-09-25");
    expect(months).toHaveLength(12);
    expect(months[0].period).toEqual({ kind: "month", year: 2025, month: 10 });
    expect(months[11].period).toEqual({ kind: "month", year: 2026, month: 9 });
  });

  it("splits each month by type, empty months included", () => {
    const months = paidByMonth(rows, "2026-09-25");
    expect(months[0]).toMatchObject({ cents: 800, byType: { cafe: 800, youth: 0 } });
    expect(months[1]).toMatchObject({ cents: 0, byType: { cafe: 0, youth: 0 } });
    expect(months[3]).toMatchObject({ cents: 400, byType: { cafe: 0, youth: 400 } });
    expect(months[11]).toMatchObject({ cents: 300, byType: { cafe: 100, youth: 200 } });
  });

  it("matches the month card and adds up to the year card", () => {
    const today = "2026-09-25";
    const months = paidByMonth(rows, today);
    const totals = paidTotals(rows, today);
    expect(months[11].cents).toBe(totals.month.cents);
    const thisYear = months.filter((month) => month.period.year === 2026);
    expect(thisYear.reduce((sum, month) => sum + month.cents, 0)).toBe(totals.year.cents);
  });
});

describe("sharePercent", () => {
  it("rounds to a whole percent", () => {
    expect(sharePercent(1, 3)).toBe("33%");
    expect(sharePercent(2, 3)).toBe("67%");
    expect(sharePercent(5, 5)).toBe("100%");
    expect(sharePercent(0, 5)).toBe("0%");
  });

  it("never shows a nonzero share as 0% or a partial one as 100%", () => {
    expect(sharePercent(1, 1000)).toBe("<1%");
    expect(sharePercent(999, 1000)).toBe(">99%");
  });

  it("is 0% of nothing", () => {
    expect(sharePercent(0, 0)).toBe("0%");
  });
});

describe("samePointBefore", () => {
  it("covers as many days of the period before", () => {
    expect(samePointBefore({ kind: "month", year: 2026, month: 9 }, "2026-09-25")).toEqual({
      start: "2026-08-01",
      end: "2026-08-25",
    });
    expect(samePointBefore({ kind: "quarter", year: 2026, quarter: 3 }, "2026-09-25")).toEqual({
      start: "2026-04-01",
      end: "2026-06-26",
    });
    expect(samePointBefore({ kind: "year", year: 2026 }, "2026-09-25")).toEqual({
      start: "2025-01-01",
      end: "2025-09-25",
    });
  });

  it("stops at the end of a shorter period", () => {
    expect(samePointBefore({ kind: "month", year: 2026, month: 3 }, "2026-03-31")).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
  });

  it("crosses into last year from January and Q1", () => {
    expect(samePointBefore({ kind: "month", year: 2026, month: 1 }, "2026-01-01")).toEqual({
      start: "2025-12-01",
      end: "2025-12-01",
    });
    expect(samePointBefore({ kind: "quarter", year: 2026, quarter: 1 }, "2026-02-10")).toEqual({
      start: "2025-10-01",
      end: "2025-11-10",
    });
  });
});

describe("paidBefore", () => {
  const rows = [
    { paid_date: "2026-08-25", amount_cents: 100, type: "cafe" as const }, // same point last month
    { paid_date: "2026-08-26", amount_cents: 200, type: "cafe" as const }, // past it
    { paid_date: "2026-06-26", amount_cents: 400, type: "youth" as const }, // same point last quarter
    { paid_date: "2026-06-27", amount_cents: 800, type: "youth" as const }, // past it
    { paid_date: "2025-09-25", amount_cents: 1600, type: "cafe" as const }, // same point last year
    { paid_date: "2025-09-26", amount_cents: 3200, type: "cafe" as const }, // past it
  ];

  it("sums the period before up to the same point", () => {
    expect(paidBefore(rows, "2026-09-25")).toEqual({ month: 100, quarter: 400, year: 1600 });
  });
});

describe("trend", () => {
  it("compares with the period before as a whole percent", () => {
    expect(trend(150, 100)).toEqual({ direction: "up", percent: 50 });
    expect(trend(25, 100)).toEqual({ direction: "down", percent: 75 });
    expect(trend(0, 100)).toEqual({ direction: "down", percent: 100 });
    expect(trend(1001, 1000)).toEqual({ direction: "same", percent: 0 });
  });

  it("is null with nothing to compare with", () => {
    expect(trend(500, 0)).toBeNull();
    expect(trend(0, 0)).toBeNull();
  });
});

describe("topPayees", () => {
  const names = new Map([
    ["a", "Alex Example"],
    ["b", "Sam Sample"],
    ["c", "Pat Example"],
  ]);
  const year = { kind: "year", year: 2026 } as const;

  it("ranks payees by cents paid in the period, ties by name", () => {
    const rows = [
      { paid_date: "2026-02-01", amount_cents: 300, type: "cafe" as const, payee_id: "b" },
      { paid_date: "2026-03-01", amount_cents: 200, type: "youth" as const, payee_id: "a" },
      { paid_date: "2026-04-01", amount_cents: 100, type: "cafe" as const, payee_id: "a" },
      { paid_date: "2026-05-01", amount_cents: 100, type: "cafe" as const, payee_id: "c" },
    ];
    expect(topPayees(rows, names, year)).toEqual([
      { id: "a", name: "Alex Example", cents: 300, count: 2 },
      { id: "b", name: "Sam Sample", cents: 300, count: 1 },
      { id: "c", name: "Pat Example", cents: 100, count: 1 },
    ]);
  });

  it("skips other periods, unknown payees, and rows past the limit", () => {
    const rows = [
      { paid_date: "2025-12-31", amount_cents: 900, type: "cafe" as const, payee_id: "c" },
      { paid_date: "2026-01-01", amount_cents: 100, type: "cafe" as const, payee_id: "z" },
      { paid_date: "2026-01-02", amount_cents: 50, type: "cafe" as const, payee_id: null },
      { paid_date: "2026-01-03", amount_cents: 20, type: "cafe" as const, payee_id: "a" },
      { paid_date: "2026-01-04", amount_cents: 10, type: "cafe" as const, payee_id: "b" },
    ];
    expect(topPayees(rows, names, year, 1)).toEqual([{ id: "a", name: "Alex Example", cents: 20, count: 1 }]);
  });
});

describe("statusTotal", () => {
  it("counts and sums one status", () => {
    const rows = [
      { status: "approved" as const, amount_cents: 100 },
      { status: "submitted" as const, amount_cents: 200 },
      { status: "approved" as const, amount_cents: 400 },
    ];
    expect(statusTotal(rows, "approved")).toEqual({ count: 2, cents: 500 });
    expect(statusTotal(rows, "needs_info")).toEqual({ count: 0, cents: 0 });
  });
});

import { describe, expect, it } from "vitest";
import {
  changeSentence,
  compareAmounts,
  comparisonLabel,
  beforeBucketLabel,
  comparisonPeriod,
  formatChange,
  rangeLabel,
} from "./comparison";

describe("comparisonPeriod", () => {
  const today = "2026-09-27";

  it("compares a running month, quarter, or year with the one before, up to the same day", () => {
    expect(comparisonPeriod({ kind: "month", year: 2026, month: 9 }, today)).toEqual({
      kind: "custom",
      start: "2026-08-01",
      end: "2026-08-27",
    });
    // 88 days into Q3, so 88 days into Q2.
    expect(comparisonPeriod({ kind: "quarter", year: 2026, quarter: 3 }, today)).toEqual({
      kind: "custom",
      start: "2026-04-01",
      end: "2026-06-28",
    });
    expect(comparisonPeriod({ kind: "year", year: 2026 }, today)).toEqual({
      kind: "custom",
      start: "2025-01-01",
      end: "2025-09-27",
    });
  });

  it("compares a finished period with the whole one before", () => {
    expect(comparisonPeriod({ kind: "month", year: 2026, month: 8 }, today)).toEqual({
      kind: "month",
      year: 2026,
      month: 7,
    });
    expect(comparisonPeriod({ kind: "quarter", year: 2026, quarter: 1 }, today)).toEqual({
      kind: "quarter",
      year: 2025,
      quarter: 4,
    });
    expect(comparisonPeriod({ kind: "year", year: 2025 }, today)).toEqual({ kind: "year", year: 2024 });
  });

  it("names the whole period before when the same point covers all of it", () => {
    // March 31 is past the end of February.
    expect(comparisonPeriod({ kind: "month", year: 2026, month: 3 }, "2026-03-31")).toEqual({
      kind: "month",
      year: 2026,
      month: 2,
    });
  });

  it("compares the first day of a period with the first day of the one before", () => {
    expect(comparisonPeriod({ kind: "month", year: 2026, month: 1 }, "2026-01-01")).toEqual({
      kind: "custom",
      start: "2025-12-01",
      end: "2025-12-01",
    });
  });

  it("compares a period that hasn't started with the whole one before", () => {
    expect(comparisonPeriod({ kind: "quarter", year: 2026, quarter: 4 }, today)).toEqual({
      kind: "quarter",
      year: 2026,
      quarter: 3,
    });
  });

  it("compares a custom range with the same number of days right before it", () => {
    // 19 days.
    expect(comparisonPeriod({ kind: "custom", start: "2026-03-15", end: "2026-04-02" }, today)).toEqual({
      kind: "custom",
      start: "2026-02-24",
      end: "2026-03-14",
    });
    expect(comparisonPeriod({ kind: "custom", start: "2026-09-10", end: "2026-09-10" }, today)).toEqual({
      kind: "custom",
      start: "2026-09-09",
      end: "2026-09-09",
    });
  });

  it("stops a running custom range's comparison at the same day", () => {
    // 31 days, 12 of them before today.
    expect(comparisonPeriod({ kind: "custom", start: "2026-09-15", end: "2026-10-15" }, today)).toEqual({
      kind: "custom",
      start: "2026-08-15",
      end: "2026-08-27",
    });
  });
});

describe("rangeLabel", () => {
  it("writes the year once, and the month once when it's shared", () => {
    expect(rangeLabel({ start: "2026-09-09", end: "2026-09-09" })).toBe("Sep 9, 2026");
    expect(rangeLabel({ start: "2026-08-01", end: "2026-08-27" })).toBe("Aug 1–27, 2026");
    expect(rangeLabel({ start: "2026-04-01", end: "2026-06-28" })).toBe("Apr 1 – Jun 28, 2026");
    expect(rangeLabel({ start: "2025-12-15", end: "2026-01-10" })).toBe("Dec 15, 2025 – Jan 10, 2026");
  });
});

describe("comparisonLabel", () => {
  it("names months, quarters, and years, and writes ranges short", () => {
    expect(comparisonLabel({ kind: "month", year: 2026, month: 8 })).toBe("August 2026");
    expect(comparisonLabel({ kind: "quarter", year: 2026, quarter: 2 })).toBe("Q2 2026");
    expect(comparisonLabel({ kind: "year", year: 2025 })).toBe("2025");
    expect(comparisonLabel({ kind: "custom", start: "2026-08-01", end: "2026-08-27" })).toBe("Aug 1–27, 2026");
  });
});

describe("beforeBucketLabel", () => {
  it("names a whole month or year like its bar", () => {
    expect(beforeBucketLabel({ start: "2026-05-01", end: "2026-05-31" }, "month")).toBe("May 2026");
    expect(beforeBucketLabel({ start: "2025-01-01", end: "2025-12-31" }, "year")).toBe("2025");
  });

  it("writes out a month or year cut short at the end of the period before", () => {
    expect(beforeBucketLabel({ start: "2026-06-01", end: "2026-06-28" }, "month")).toBe("Jun 1–28, 2026");
    expect(beforeBucketLabel({ start: "2025-01-01", end: "2025-09-27" }, "year")).toBe("Jan 1 – Sep 27, 2025");
  });

  it("names days and weeks like their bars", () => {
    expect(beforeBucketLabel({ start: "2026-08-05", end: "2026-08-05" }, "day")).toBe("Aug 5");
    expect(beforeBucketLabel({ start: "2026-04-01", end: "2026-04-07" }, "week")).toBe("Apr 1 – 7");
  });
});

describe("compareAmounts", () => {
  it("gives the change and its whole percent", () => {
    expect(compareAmounts(82000, 68000)).toEqual({ direction: "up", cents: 14000, percent: 21 });
    expect(compareAmounts(3000, 4000)).toEqual({ direction: "down", cents: 1000, percent: 25 });
    expect(compareAmounts(0, 5000)).toEqual({ direction: "down", cents: 5000, percent: 100 });
    expect(compareAmounts(500, 500)).toEqual({ direction: "same", cents: 0, percent: 0 });
  });

  it("has no percent when there was nothing before", () => {
    expect(compareAmounts(12000, 0)).toEqual({ direction: "up", cents: 12000, percent: null });
    expect(compareAmounts(0, 0)).toEqual({ direction: "same", cents: 0, percent: null });
  });
});

describe("formatChange", () => {
  it("signs the amount and adds the percent", () => {
    expect(formatChange(compareAmounts(82000, 68000))).toEqual({ amount: "+$140.00", percent: "(21%)" });
    expect(formatChange(compareAmounts(3000, 4000))).toEqual({ amount: "−$10.00", percent: "(25%)" });
  });

  it("has no percent when there was nothing before", () => {
    expect(formatChange(compareAmounts(12000, 0))).toEqual({ amount: "+$120.00", percent: null });
  });

  it("says when nothing changed", () => {
    expect(formatChange(compareAmounts(500, 500))).toEqual({ amount: "No change", percent: null });
    expect(formatChange(compareAmounts(0, 0))).toEqual({ amount: "No change", percent: null });
  });

  it("shows a tiny change as under 1%", () => {
    expect(formatChange(compareAmounts(100100, 100000))).toEqual({ amount: "+$1.00", percent: "(<1%)" });
  });
});

describe("changeSentence", () => {
  it("says it in words for screen readers", () => {
    expect(changeSentence(82000, 68000, "Aug 1–27, 2026")).toBe("Up $140.00, 21%, from $680.00 in Aug 1–27, 2026.");
    expect(changeSentence(3000, 4000, "Q2 2026")).toBe("Down $10.00, 25%, from $40.00 in Q2 2026.");
    expect(changeSentence(12000, 0, "Q2 2026")).toBe("Up $120.00 from $0.00 in Q2 2026.");
    expect(changeSentence(500, 500, "Q2 2026")).toBe("The same as $5.00 in Q2 2026.");
  });
});

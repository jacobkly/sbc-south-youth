import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatDate,
  formatDateTime,
  isIsoDate,
  laDateOf,
  periodContaining,
  periodLabel,
  periodRange,
  todayInLA,
} from "./dates";

describe("todayInLA", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays on the LA date until LA midnight, even after UTC midnight (PDT)", () => {
    // 11:30 PM PDT on Sep 25 is already Sep 26 in UTC.
    expect(todayInLA(new Date("2026-09-26T06:30:00Z"))).toBe("2026-09-25");
    expect(todayInLA(new Date("2026-09-26T06:59:59Z"))).toBe("2026-09-25");
    expect(todayInLA(new Date("2026-09-26T07:00:00Z"))).toBe("2026-09-26");
  });

  it("uses the standard-time offset in winter (PST)", () => {
    expect(todayInLA(new Date("2026-12-01T07:59:59Z"))).toBe("2026-11-30");
    expect(todayInLA(new Date("2026-12-01T08:00:00Z"))).toBe("2026-12-01");
  });

  it("rolls over the new year on LA time", () => {
    expect(todayInLA(new Date("2027-01-01T07:59:59Z"))).toBe("2026-12-31");
    expect(todayInLA(new Date("2027-01-01T08:00:00Z"))).toBe("2027-01-01");
  });

  it("defaults to the current time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T06:30:00Z"));
    expect(todayInLA()).toBe("2026-09-25");
  });
});

describe("laDateOf", () => {
  it("accepts ISO timestamps from Postgres", () => {
    expect(laDateOf("2026-07-01T03:15:00+00:00")).toBe("2026-06-30");
    expect(laDateOf("2026-07-01T12:00:00+00:00")).toBe("2026-07-01");
  });

  it("rejects invalid instants", () => {
    expect(() => laDateOf("not a date")).toThrow(RangeError);
  });
});

describe("isIsoDate", () => {
  it.each(["2026-09-25", "2024-02-29", "2026-12-31", "2026-01-01"])("accepts %s", (value) => {
    expect(isIsoDate(value)).toBe(true);
  });

  it.each(["2026-02-29", "2026-13-01", "2026-00-10", "2026-04-31", "2026-9-25", "09/25/2026", ""])(
    "rejects %j",
    (value) => {
      expect(isIsoDate(value)).toBe(false);
    },
  );
});

describe("periodRange", () => {
  it("covers a whole month, including leap-year February", () => {
    expect(periodRange({ kind: "month", year: 2026, month: 9 })).toEqual({
      start: "2026-09-01",
      end: "2026-09-30",
    });
    expect(periodRange({ kind: "month", year: 2028, month: 2 })).toEqual({
      start: "2028-02-01",
      end: "2028-02-29",
    });
    expect(periodRange({ kind: "month", year: 2026, month: 2 }).end).toBe("2026-02-28");
  });

  it.each([
    [1, "2026-01-01", "2026-03-31"],
    [2, "2026-04-01", "2026-06-30"],
    [3, "2026-07-01", "2026-09-30"],
    [4, "2026-10-01", "2026-12-31"],
  ])("covers calendar quarter Q%i", (quarter, start, end) => {
    expect(periodRange({ kind: "quarter", year: 2026, quarter })).toEqual({ start, end });
  });

  it("covers a calendar year", () => {
    expect(periodRange({ kind: "year", year: 2026 })).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });

  it("passes through a valid custom range, including a single day", () => {
    expect(periodRange({ kind: "custom", start: "2026-03-15", end: "2026-04-02" })).toEqual({
      start: "2026-03-15",
      end: "2026-04-02",
    });
    expect(periodRange({ kind: "custom", start: "2026-03-15", end: "2026-03-15" }).end).toBe("2026-03-15");
  });

  it("rejects invalid periods", () => {
    expect(() => periodRange({ kind: "month", year: 2026, month: 13 })).toThrow(RangeError);
    expect(() => periodRange({ kind: "quarter", year: 2026, quarter: 5 })).toThrow(RangeError);
    expect(() => periodRange({ kind: "custom", start: "2026-04-02", end: "2026-03-15" })).toThrow(RangeError);
    expect(() => periodRange({ kind: "custom", start: "2026-02-30", end: "2026-03-15" })).toThrow(RangeError);
  });
});

describe("periodContaining", () => {
  it.each([
    ["2026-01-01", 1],
    ["2026-03-31", 1],
    ["2026-04-01", 2],
    ["2026-09-30", 3],
    ["2026-10-01", 4],
    ["2026-12-31", 4],
  ])("puts %s in Q%i", (date, quarter) => {
    expect(periodContaining("quarter", date)).toEqual({ kind: "quarter", year: 2026, quarter });
  });

  it("finds the month and year", () => {
    expect(periodContaining("month", "2026-09-25")).toEqual({ kind: "month", year: 2026, month: 9 });
    expect(periodContaining("year", "2026-09-25")).toEqual({ kind: "year", year: 2026 });
  });

  it("contains the date it was built from", () => {
    const date = "2026-08-17";
    for (const kind of ["month", "quarter", "year"] as const) {
      const { start, end } = periodRange(periodContaining(kind, date));
      expect(start <= date && date <= end).toBe(true);
    }
  });
});

describe("labels", () => {
  it("labels periods", () => {
    expect(periodLabel({ kind: "month", year: 2026, month: 9 })).toBe("September 2026");
    expect(periodLabel({ kind: "quarter", year: 2026, quarter: 3 })).toBe("Q3 2026");
    expect(periodLabel({ kind: "year", year: 2026 })).toBe("2026");
    expect(periodLabel({ kind: "custom", start: "2026-03-15", end: "2026-04-02" })).toBe(
      "Mar 15, 2026 – Apr 2, 2026",
    );
  });

  it("formats plain dates without shifting the day", () => {
    expect(formatDate("2026-01-01")).toBe("Jan 1, 2026");
    expect(formatDate("2026-12-31")).toBe("Dec 31, 2026");
  });

  it("formats instants in LA time", () => {
    expect(formatDateTime("2026-09-26T06:30:00Z")).toBe("Sep 25, 2026, 11:30 PM");
  });
});

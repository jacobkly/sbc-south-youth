import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDays,
  daysBetween,
  formatDate,
  formatDateTime,
  isIsoDate,
  laDateOf,
  laDateTime,
  laMidnight,
  laNoon,
  monthShortName,
  periodContaining,
  periodLabel,
  periodRange,
  recentMonths,
  shiftPeriod,
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

describe("recentMonths", () => {
  it("ends with the month containing the date, oldest first", () => {
    expect(recentMonths(3, "2026-09-25")).toEqual([
      { kind: "month", year: 2026, month: 7 },
      { kind: "month", year: 2026, month: 8 },
      { kind: "month", year: 2026, month: 9 },
    ]);
  });

  it("crosses into the previous year", () => {
    const months = recentMonths(12, "2026-02-01");
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ kind: "month", year: 2025, month: 3 });
    expect(months[10]).toEqual({ kind: "month", year: 2026, month: 1 });
    expect(months[11]).toEqual({ kind: "month", year: 2026, month: 2 });
  });

  it("always reaches back to this year's January within 12 months", () => {
    const [first] = recentMonths(12, "2026-12-31");
    expect(first).toEqual({ kind: "month", year: 2026, month: 1 });
  });
});

describe("shiftPeriod", () => {
  it("steps months across year ends", () => {
    expect(shiftPeriod({ kind: "month", year: 2026, month: 1 }, -1)).toEqual({ kind: "month", year: 2025, month: 12 });
    expect(shiftPeriod({ kind: "month", year: 2026, month: 12 }, 1)).toEqual({ kind: "month", year: 2027, month: 1 });
    expect(shiftPeriod({ kind: "month", year: 2026, month: 9 }, -14)).toEqual({ kind: "month", year: 2025, month: 7 });
  });

  it("steps quarters and years", () => {
    expect(shiftPeriod({ kind: "quarter", year: 2026, quarter: 1 }, -1)).toEqual({
      kind: "quarter",
      year: 2025,
      quarter: 4,
    });
    expect(shiftPeriod({ kind: "quarter", year: 2026, quarter: 4 }, 1)).toEqual({ kind: "quarter", year: 2027, quarter: 1 });
    expect(shiftPeriod({ kind: "year", year: 2026 }, -2)).toEqual({ kind: "year", year: 2024 });
  });
});

describe("labels", () => {
  it("labels periods", () => {
    expect(periodLabel({ kind: "month", year: 2026, month: 9 })).toBe("September 2026");
    expect(periodLabel({ kind: "quarter", year: 2026, quarter: 3 })).toBe("Q3 2026");
    expect(periodLabel({ kind: "year", year: 2026 })).toBe("2026");
    expect(monthShortName({ kind: "month", year: 2026, month: 9 })).toBe("Sep");
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

  it("writes instants as LA date and time for spreadsheets", () => {
    expect(laDateTime("2026-09-26T06:30:00Z")).toBe("2026-09-25 23:30");
    expect(laDateTime("2026-01-15T20:05:59Z")).toBe("2026-01-15 12:05");
    expect(laDateTime("2026-07-01T07:00:00Z")).toBe("2026-07-01 00:00");
  });
});

describe("daysBetween", () => {
  it("counts whole days, across months, years, and leap days", () => {
    expect(daysBetween("2026-09-25", "2026-09-25")).toBe(0);
    expect(daysBetween("2026-07-27", "2026-09-25")).toBe(60);
    expect(daysBetween("2027-12-31", "2028-03-01")).toBe(61);
    expect(daysBetween("2026-09-25", "2026-09-20")).toBe(-5);
  });

  it("isn't thrown off by daylight saving changes", () => {
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
  });
});

describe("addDays", () => {
  it("moves across months, years, and leap days", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-09-25", 0)).toBe("2026-09-25");
  });
});

describe("laNoon", () => {
  it("is noon in LA, in both daylight and standard time", () => {
    expect(laNoon("2026-09-25").toISOString()).toBe("2026-09-25T19:00:00.000Z");
    expect(laNoon("2026-01-15").toISOString()).toBe("2026-01-15T20:00:00.000Z");
  });

  it("stays on the same LA date on daylight saving change days", () => {
    expect(laNoon("2026-03-08").toISOString()).toBe("2026-03-08T19:00:00.000Z");
    expect(laNoon("2026-11-01").toISOString()).toBe("2026-11-01T20:00:00.000Z");
    expect(laDateOf(laNoon("2026-03-08"))).toBe("2026-03-08");
  });
});

describe("laMidnight", () => {
  it("is the start of the LA date, in both daylight and standard time", () => {
    expect(laMidnight("2026-01-01").toISOString()).toBe("2026-01-01T08:00:00.000Z");
    expect(laMidnight("2026-07-01").toISOString()).toBe("2026-07-01T07:00:00.000Z");
  });

  it("uses the offset in effect at midnight on daylight saving change days", () => {
    expect(laMidnight("2026-03-08").toISOString()).toBe("2026-03-08T08:00:00.000Z");
    expect(laMidnight("2026-11-01").toISOString()).toBe("2026-11-01T07:00:00.000Z");
  });

  it("is the first instant of the date", () => {
    const start = laMidnight("2027-01-01");
    expect(laDateOf(start)).toBe("2027-01-01");
    expect(laDateOf(new Date(start.getTime() - 1))).toBe("2026-12-31");
  });
});

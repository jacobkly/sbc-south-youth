import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDays,
  daysBetween,
  formatDate,
  formatTime,
  formatWeekdayDate,
  isIsoDate,
  laDateOf,
  laInstant,
  laMidnight,
  todayInLA,
  weekdayOf,
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

  it("defaults to the current time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T06:30:00Z"));
    expect(todayInLA()).toBe("2026-09-25");
  });
});

describe("laDateOf", () => {
  it("accepts ISO timestamps", () => {
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

describe("laInstant", () => {
  it("reads a date and wall-clock time in LA, in daylight and standard time", () => {
    expect(laInstant("2026-09-30", "19:00").toISOString()).toBe("2026-10-01T02:00:00.000Z");
    expect(laInstant("2026-12-02", "19:00").toISOString()).toBe("2026-12-03T03:00:00.000Z");
    expect(laInstant("2026-10-04", "09:30").toISOString()).toBe("2026-10-04T16:30:00.000Z");
  });

  it("works on daylight saving change days", () => {
    expect(laInstant("2026-03-08", "19:00").toISOString()).toBe("2026-03-09T02:00:00.000Z");
    expect(laInstant("2026-11-01", "19:00").toISOString()).toBe("2026-11-02T03:00:00.000Z");
  });

  it("rejects bad times", () => {
    expect(() => laInstant("2026-09-30", "7pm")).toThrow(RangeError);
    expect(() => laInstant("2026-09-30", "24:00")).toThrow(RangeError);
    expect(() => laInstant("2026-02-30", "19:00")).toThrow(RangeError);
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

describe("addDays and daysBetween", () => {
  it("move across months, years, and leap days", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("count whole days, even across daylight saving changes", () => {
    expect(daysBetween("2026-09-25", "2026-09-25")).toBe(0);
    expect(daysBetween("2026-07-27", "2026-09-25")).toBe(60);
    expect(daysBetween("2026-09-25", "2026-09-20")).toBe(-5);
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
  });
});

describe("weekdayOf", () => {
  it("numbers days from Sunday (0) to Saturday (6)", () => {
    expect(weekdayOf("2026-09-27")).toBe(0);
    expect(weekdayOf("2026-09-30")).toBe(3);
    expect(weekdayOf("2026-10-03")).toBe(6);
  });
});

describe("labels", () => {
  it("formats plain dates without shifting the day", () => {
    expect(formatDate("2026-01-01")).toBe("Jan 1, 2026");
    expect(formatDate("2026-12-31")).toBe("Dec 31, 2026");
  });

  it("formats a date with its weekday, leaving out this year", () => {
    expect(formatWeekdayDate("2026-09-25", "2026-09-28")).toBe("Fri, Sep 25");
    expect(formatWeekdayDate("2027-01-06", "2026-12-30")).toBe("Wed, Jan 6, 2027");
  });

  it("formats the time of an instant in LA time", () => {
    expect(formatTime("2026-09-26T06:30:00Z")).toBe("11:30 PM");
    expect(formatTime("2026-10-01T02:00:00Z")).toBe("7:00 PM");
  });
});

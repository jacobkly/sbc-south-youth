import { describe, expect, it } from "vitest";
import { todayInLA } from "@/lib/dates";
import {
  defaultWeekEnding,
  isWeekEnding,
  latestWeekEnding,
  relativeWeekLabel,
  weekEndingOf,
  weekLabel,
  weekStartOf,
} from "./weeks";

// October 4, 2026 is a Sunday.
const TODAY = "2026-10-05";

describe("weekEndingOf", () => {
  it("keeps a Sunday, which ends its own week", () => {
    expect(weekEndingOf("2026-10-04")).toBe("2026-10-04");
  });

  it("moves a Monday to the Sunday after it", () => {
    expect(weekEndingOf("2026-10-05")).toBe("2026-10-11");
  });

  it("ends a week that starts in one month in the next", () => {
    expect(weekEndingOf("2026-09-30")).toBe("2026-10-04");
  });

  it("ends a week that starts in December in January", () => {
    expect(weekEndingOf("2026-12-31")).toBe("2027-01-03");
  });

  it("ends the week daylight saving time ends in on that Sunday", () => {
    // Clocks fall back at 2 AM on Sunday, November 1, 2026.
    expect(weekEndingOf("2026-10-26")).toBe("2026-11-01");
    expect(weekEndingOf(todayInLA(new Date("2026-11-02T07:30:00Z")))).toBe("2026-11-01");
  });

  it("ends the week daylight saving time starts in on that Sunday", () => {
    // Clocks spring forward at 2 AM on Sunday, March 8, 2026.
    expect(weekEndingOf("2026-03-02")).toBe("2026-03-08");
    expect(weekEndingOf(todayInLA(new Date("2026-03-09T06:30:00Z")))).toBe("2026-03-08");
  });
});

describe("weekStartOf", () => {
  it("is the Monday six days before", () => {
    expect(weekStartOf("2026-10-04")).toBe("2026-09-28");
    expect(weekStartOf("2026-11-01")).toBe("2026-10-26");
  });
});

describe("isWeekEnding", () => {
  it("is true only for a Sunday", () => {
    expect(isWeekEnding("2026-10-04")).toBe(true);
    expect(isWeekEnding("2026-10-05")).toBe(false);
    expect(isWeekEnding("2026-10-10")).toBe(false);
  });

  it("is false for something that isn't a date", () => {
    expect(isWeekEnding("")).toBe(false);
    expect(isWeekEnding("2026-02-30")).toBe(false);
  });
});

describe("defaultWeekEnding", () => {
  it("opens on the week that just ended on a Monday", () => {
    expect(defaultWeekEnding("2026-10-05")).toBe("2026-10-04");
  });

  it("opens on the week that ended last Sunday later in the week", () => {
    expect(defaultWeekEnding("2026-10-10")).toBe("2026-10-04");
  });

  it("opens on this week on a Sunday", () => {
    expect(defaultWeekEnding("2026-10-11")).toBe("2026-10-11");
  });
});

describe("latestWeekEnding", () => {
  it("is this week, which can be entered before it ends", () => {
    expect(latestWeekEnding("2026-10-05")).toBe("2026-10-11");
    expect(latestWeekEnding("2026-10-11")).toBe("2026-10-11");
  });
});

describe("weekLabel", () => {
  it("names the month once for a week inside one month", () => {
    expect(weekLabel("2026-10-11", TODAY)).toBe("Oct 5 – 11");
  });

  it("names both months for a week across two", () => {
    expect(weekLabel("2026-10-04", TODAY)).toBe("Sep 28 – Oct 4");
  });

  it("adds the year for a week from another year", () => {
    expect(weekLabel("2025-10-05", TODAY)).toBe("Sep 29 – Oct 5, 2025");
  });

  it("gives both years for a week across New Year's", () => {
    expect(weekLabel("2027-01-03", "2026-12-31")).toBe("Dec 28, 2026 – Jan 3, 2027");
  });
});

describe("relativeWeekLabel", () => {
  it("names this week and last week", () => {
    expect(relativeWeekLabel("2026-10-11", TODAY)).toBe("This week");
    expect(relativeWeekLabel("2026-10-04", TODAY)).toBe("Last week");
  });

  it("has nothing for an older week", () => {
    expect(relativeWeekLabel("2026-09-27", TODAY)).toBeNull();
  });
});

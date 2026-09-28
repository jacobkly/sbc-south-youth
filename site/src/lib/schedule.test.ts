import { describe, expect, it } from "vitest";
import { formatClock, formatClockRange, weekdayName } from "./schedule";

describe("weekdayName", () => {
  it("names the day, or the plural for something weekly", () => {
    expect(weekdayName(0)).toBe("Sunday");
    expect(weekdayName(3)).toBe("Wednesday");
    expect(weekdayName(3, { plural: true })).toBe("Wednesdays");
  });

  it("refuses a day that doesn't exist", () => {
    expect(() => weekdayName(7)).toThrow(RangeError);
  });
});

describe("formatClock", () => {
  it("drops :00 and adds AM or PM", () => {
    expect(formatClock("19:00")).toBe("7 PM");
    expect(formatClock("19:30")).toBe("7:30 PM");
    expect(formatClock("00:15")).toBe("12:15 AM");
    expect(formatClock("12:00")).toBe("12 PM");
  });
});

describe("formatClockRange", () => {
  it("shares AM or PM when both ends have it", () => {
    expect(formatClockRange("19:00", "21:00")).toBe("7–9 PM");
    expect(formatClockRange("19:30", "21:30")).toBe("7:30–9:30 PM");
    expect(formatClockRange("18:00", "20:30")).toBe("6–8:30 PM");
  });

  it("spells out both when the range crosses noon", () => {
    expect(formatClockRange("11:00", "13:00")).toBe("11 AM–1 PM");
  });

  it("refuses a time that isn't HH:MM", () => {
    expect(() => formatClockRange("7pm", "21:00")).toThrow(RangeError);
  });
});

import { describe, expect, it } from "vitest";
import { laInstant } from "@/lib/dates";
import { PRESETS, presetEnd } from "./presets";

describe("presetEnd", () => {
  it("ends Tonight only at 11:59 PM on the day it starts", () => {
    expect(presetEnd("tonight", laInstant("2026-10-07", "15:20")).toISOString()).toBe("2026-10-08T06:59:00.000Z");
  });

  it("ends This week at 11:59 PM on the coming Sunday", () => {
    // Wednesday, October 7.
    expect(presetEnd("week", laInstant("2026-10-07", "15:20"))).toEqual(laInstant("2026-10-11", "23:59"));
  });

  it("gives a heads-up started on a Sunday the week ahead", () => {
    expect(presetEnd("week", laInstant("2026-10-11", "09:00"))).toEqual(laInstant("2026-10-18", "23:59"));
  });

  it("ends Until Friday at 11:59 PM on the coming Friday", () => {
    // Monday, October 5.
    expect(presetEnd("friday", laInstant("2026-10-05", "08:00"))).toEqual(laInstant("2026-10-09", "23:59"));
  });

  it("ends Until Friday that night when it's already Friday", () => {
    expect(presetEnd("friday", laInstant("2026-10-09", "12:00"))).toEqual(laInstant("2026-10-09", "23:59"));
  });

  it("ends Until Friday the next week when it starts on a Saturday", () => {
    expect(presetEnd("friday", laInstant("2026-10-10", "12:00"))).toEqual(laInstant("2026-10-16", "23:59"));
  });

  it("counts from the start's day in Los Angeles, even when it's already tomorrow in UTC", () => {
    // 10:30 PM on Wednesday in LA is 5:30 AM Thursday in UTC.
    const start = new Date("2026-10-08T05:30:00Z");

    expect(presetEnd("tonight", start).toISOString()).toBe("2026-10-08T06:59:00.000Z");
  });

  it("keeps 11:59 PM on the clock across the fall-back change", () => {
    // Clocks go back on Sunday, November 1, so that night is PST (UTC−8), not PDT.
    const friday = laInstant("2026-10-30", "18:00");

    expect(presetEnd("week", friday).toISOString()).toBe("2026-11-02T07:59:00.000Z");
  });

  it("keeps 11:59 PM on the clock across the spring-forward change", () => {
    // Clocks go forward on Sunday, March 14, 2027, so that night is PDT (UTC−7).
    const friday = laInstant("2027-03-12", "18:00");

    expect(presetEnd("week", friday).toISOString()).toBe("2027-03-15T06:59:00.000Z");
  });
});

describe("PRESETS", () => {
  it("lists the presets in the order the composer shows them", () => {
    expect(PRESETS.map((preset) => preset.label)).toEqual(["Tonight only", "This week", "Until Friday"]);
  });
});

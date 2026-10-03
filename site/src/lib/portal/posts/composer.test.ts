import { describe, expect, it } from "vitest";
import { laInstant } from "@/lib/dates";
import { composerStart, matchingPreset, nextHour, primaryAction } from "./composer";

// Monday, October 5, 2026 at 9 AM in Los Angeles.
const now = laInstant("2026-10-05", "09:00");

describe("nextHour", () => {
  it("offers the next whole hour on the Los Angeles clock", () => {
    expect(nextHour(laInstant("2026-10-05", "09:20"))).toBe("2026-10-05T10:00");
  });

  it("moves on an hour when it's already on the hour", () => {
    expect(nextHour(now)).toBe("2026-10-05T10:00");
  });

  it("rolls over to the next day late at night", () => {
    expect(nextHour(laInstant("2026-10-05", "23:30"))).toBe("2026-10-06T00:00");
  });
});

describe("matchingPreset", () => {
  it("finds the quick end a time matches, counted from the start", () => {
    expect(matchingPreset(now, "2026-10-05T23:59")).toBe("tonight");
    expect(matchingPreset(now, "2026-10-11T23:59")).toBe("week");
    expect(matchingPreset(now, "2026-10-09T23:59")).toBe("friday");
  });

  it("finds none for a time someone picked themselves", () => {
    expect(matchingPreset(now, "2026-10-10T12:00")).toBeNull();
    expect(matchingPreset(now, "")).toBeNull();
  });
});

describe("composerStart", () => {
  it("uses a start that was picked", () => {
    expect(composerStart("2026-10-08T09:00", null, now)).toEqual(laInstant("2026-10-08", "09:00"));
  });

  it("keeps a live heads-up's own start", () => {
    expect(composerStart("", "2026-10-04T16:00:00.000Z", now)).toEqual(new Date("2026-10-04T16:00:00.000Z"));
  });

  it("means now when there's no start yet, or it isn't a time", () => {
    expect(composerStart("", null, now)).toEqual(now);
    expect(composerStart("2026-13-40T09:00", null, now)).toEqual(now);
  });
});

describe("primaryAction", () => {
  const later = laInstant("2026-10-08", "09:00");

  it("publishes or schedules a new heads-up or a draft", () => {
    expect(primaryAction(null, now, now)).toEqual({ label: "Publish", pending: "Publishing…" });
    expect(primaryAction("draft", later, now)).toEqual({ label: "Schedule", pending: "Scheduling…" });
  });

  it("saves changes to one that's up or scheduled", () => {
    expect(primaryAction("live", now, now).label).toBe("Save changes");
    expect(primaryAction("scheduled", later, now).label).toBe("Save changes");
  });

  it("says so when a scheduled one's start moves to now", () => {
    expect(primaryAction("scheduled", now, now)).toEqual({ label: "Publish now", pending: "Publishing…" });
  });
});

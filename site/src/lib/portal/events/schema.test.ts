import { describe, expect, it } from "vitest";
import { laInstant } from "@/lib/dates";
import { checkEvent } from "./schema";

// Wednesday, October 7, 2026 at 3 PM in Los Angeles.
const now = laInstant("2026-10-07", "15:00");

const valid = {
  title: "Worship Night",
  summary: "A night of worship, open to everyone.",
  body: "Come early for snacks.",
  allDay: false,
  startDate: "2026-11-14",
  startTime: "19:00",
  endDate: "2026-11-14",
  endTime: "21:00",
  locationName: "Youth room",
  address: "",
  costNote: "Free",
  featured: true,
};

function errorsFor(values: Record<string, unknown>) {
  const result = checkEvent(values, { now });
  return result.ok ? {} : result.errors;
}

describe("checkEvent", () => {
  it("turns the form into the row's columns, on the Los Angeles clock", () => {
    expect(checkEvent(valid, { now })).toEqual({
      ok: true,
      event: {
        title: "Worship Night",
        summary: "A night of worship, open to everyone.",
        body: "Come early for snacks.",
        all_day: false,
        starts_at: "2026-11-15T03:00:00.000Z",
        ends_at: "2026-11-15T05:00:00.000Z",
        location_name: "Youth room",
        address: null,
        cost_note: "Free",
        featured: true,
      },
    });
  });

  it("runs an all-day event from midnight on its first day to midnight after its last", () => {
    // Daylight saving ends on Sunday, November 1, so the two midnights are an hour apart in UTC.
    const values = { ...valid, allDay: true, startDate: "2026-10-30", startTime: "", endDate: "2026-11-01" };
    const result = checkEvent(values, { now });

    expect(result.ok && [result.event.all_day, result.event.starts_at, result.event.ends_at]).toEqual([
      true,
      "2026-10-30T07:00:00.000Z",
      "2026-11-02T08:00:00.000Z",
    ]);
  });

  it("tidies the words: one line for the short fields, paragraphs kept in the body", () => {
    const values = {
      ...valid,
      title: "  Worship   Night ",
      summary: " One\nline  only. ",
      body: "\r\nFirst paragraph.\r\n\r\nSecond one.  ",
      locationName: "  Youth   room ",
    };
    const result = checkEvent(values, { now });

    expect(result.ok && result.event).toMatchObject({
      title: "Worship Night",
      summary: "One line only.",
      body: "First paragraph.\n\nSecond one.",
      location_name: "Youth room",
    });
  });

  it("leaves blank details out", () => {
    const values = { ...valid, summary: " ", body: "\n", locationName: "", address: "  ", costNote: "" };
    const result = checkEvent(values, { now });

    expect(result.ok && result.event).toMatchObject({
      summary: null,
      body: null,
      location_name: null,
      address: null,
      cost_note: null,
    });
  });

  it("needs a title", () => {
    expect(errorsFor({ ...valid, title: "  " }).title).toBe("Give it a title.");
  });

  it("keeps each field to the database's length", () => {
    const tooLong = {
      ...valid,
      title: "a".repeat(81),
      summary: "a".repeat(161),
      body: "a".repeat(4001),
      locationName: "a".repeat(101),
      address: "a".repeat(201),
      costNote: "a".repeat(61),
    };

    expect(errorsFor(tooLong)).toEqual({
      title: "Keep the title to 80 characters or fewer.",
      summary: "Keep the short description to 160 characters or fewer.",
      body: "Keep it to 4,000 characters or fewer.",
      locationName: "Keep the place to 100 characters or fewer.",
      address: "Keep the address to 200 characters or fewer.",
      costNote: "Keep the cost to 60 characters or fewer.",
    });
    expect(
      errorsFor({
        ...valid,
        title: "a".repeat(80),
        summary: "a".repeat(160),
        body: "a".repeat(4000),
        locationName: "a".repeat(100),
        address: "a".repeat(200),
        costNote: "a".repeat(60),
      }),
    ).toEqual({});
  });

  describe("when", () => {
    it("needs real dates and times", () => {
      const values = { ...valid, startDate: "2026-02-30", startTime: "7pm", endDate: "", endTime: "" };

      expect(errorsFor(values)).toEqual({
        startDate: "Pick the day it starts.",
        startTime: "Pick the time it starts.",
        endDate: "Pick the day it ends.",
        endTime: "Pick the time it ends.",
      });
    });

    it("takes the seconds some time pickers add", () => {
      const result = checkEvent({ ...valid, startTime: "19:00:00", endTime: "21:00:00" }, { now });

      expect(result.ok && result.event.starts_at).toBe("2026-11-15T03:00:00.000Z");
    });

    it("doesn't need times for an all-day event", () => {
      const values = { ...valid, allDay: true, startTime: "", endTime: "nonsense" };

      expect(errorsFor(values)).toEqual({});
    });

    it("names the days for an all-day event", () => {
      const values = { ...valid, allDay: true, startDate: "", endDate: "" };

      expect(errorsFor(values)).toEqual({ startDate: "Pick the first day.", endDate: "Pick the last day." });
    });

    it("needs the end after the start, on the field that's off", () => {
      expect(errorsFor({ ...valid, endTime: "19:00" })).toEqual({ endTime: "Pick an end after the start." });
      expect(errorsFor({ ...valid, endDate: "2026-11-13" })).toEqual({ endDate: "Pick an end after the start." });
    });

    it("lets an all-day event be one day, but not end before it starts", () => {
      const oneDay = { ...valid, allDay: true, endDate: "2026-11-14" };

      expect(errorsFor(oneDay)).toEqual({});
      expect(errorsFor({ ...oneDay, endDate: "2026-11-13" })).toEqual({
        endDate: "Pick a last day on or after the first day.",
      });
    });

    it("refuses an event that would already be over", () => {
      const earlierToday = { startDate: "2026-10-07", startTime: "13:00", endDate: "2026-10-07", endTime: "14:00" };

      expect(errorsFor({ ...valid, ...earlierToday })).toEqual({ endTime: "That's already over. Pick a later end." });
      expect(errorsFor({ ...valid, startDate: "2026-10-01", endDate: "2026-10-01" })).toEqual({
        endDate: "That's already over. Pick a later end.",
      });
    });

    it("lets an event that's happening now be saved", () => {
      const rightNow = { startDate: "2026-10-07", startTime: "14:00", endDate: "2026-10-07", endTime: "16:00" };

      expect(errorsFor({ ...valid, ...rightNow })).toEqual({});
      expect(errorsFor({ ...valid, allDay: true, startDate: "2026-10-07", endDate: "2026-10-07" })).toEqual({});
    });

    it("keeps an event to 31 days", () => {
      const allDay = { ...valid, allDay: true, startDate: "2026-11-01" };

      expect(errorsFor({ ...allDay, endDate: "2026-12-01" })).toEqual({});
      expect(errorsFor({ ...allDay, endDate: "2026-12-02" })).toEqual({
        endDate: "An event can run 31 days at most. Pick an earlier end.",
      });
      expect(errorsFor({ ...valid, startDate: "2026-11-01", endDate: "2026-12-02", endTime: "19:01" })).toEqual({
        endDate: "An event can run 31 days at most. Pick an earlier end.",
      });
    });
  });

  it("reports every problem at once", () => {
    const values = { ...valid, title: "", costNote: "a".repeat(61), endTime: "18:00" };

    expect(errorsFor(values)).toEqual({
      title: "Give it a title.",
      costNote: "Keep the cost to 60 characters or fewer.",
      endTime: "Pick an end after the start.",
    });
  });

  it("treats a missing or odd form as blank fields", () => {
    const blank = ["endDate", "endTime", "startDate", "startTime", "title"];

    expect(Object.keys(errorsFor({})).sort()).toEqual(blank);
    expect(Object.keys(errorsFor(null as unknown as Record<string, unknown>)).sort()).toEqual(blank);
  });
});

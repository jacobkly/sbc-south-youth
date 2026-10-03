import { describe, expect, it } from "vitest";
import { laInstant, laMidnight } from "@/lib/dates";
import { eventState, groupEvents, whenLabel, type EventRow } from "./list";

// Wednesday, October 7, 2026 at 3 PM in Los Angeles.
const now = laInstant("2026-10-07", "15:00");
const today = "2026-10-07";

function event(overrides: Partial<EventRow> & Pick<EventRow, "id">): EventRow {
  return {
    slug: overrides.id,
    title: "Worship Night",
    summary: null,
    body: null,
    starts_at: laInstant("2026-11-14", "19:00").toISOString(),
    ends_at: laInstant("2026-11-14", "21:00").toISOString(),
    all_day: false,
    location_name: null,
    address: null,
    cost_note: null,
    featured: false,
    status: "published",
    cancel_reason: null,
    updated_at: now.toISOString(),
    ...overrides,
  };
}

const at = (date: string, time: string) => laInstant(date, time).toISOString();

describe("eventState", () => {
  it("keeps a draft a draft, whenever it would be", () => {
    expect(eventState(event({ id: "a", status: "draft" }), now)).toBe("draft");
    expect(eventState(event({ id: "a", status: "draft", ends_at: at("2026-10-01", "21:00") }), now)).toBe("draft");
  });

  it("tells a coming event from one that's happening or over", () => {
    expect(eventState(event({ id: "a" }), now)).toBe("upcoming");
    expect(eventState(event({ id: "a", starts_at: at(today, "14:00"), ends_at: at(today, "16:00") }), now)).toBe(
      "happening",
    );
    expect(eventState(event({ id: "a", starts_at: at(today, "13:00"), ends_at: at(today, "15:00") }), now)).toBe(
      "past",
    );
  });

  it("calls a cancelled event cancelled until it would have ended", () => {
    expect(eventState(event({ id: "a", status: "cancelled" }), now)).toBe("cancelled");
    expect(eventState(event({ id: "a", status: "cancelled", ends_at: at(today, "14:00") }), now)).toBe("past");
  });
});

describe("groupEvents", () => {
  it("puts coming, happening, and cancelled events together, soonest first", () => {
    const later = event({ id: "later", starts_at: at("2026-12-01", "19:00"), ends_at: at("2026-12-01", "21:00") });
    const cancelled = event({ id: "cancelled", status: "cancelled" });
    const happening = event({ id: "now", starts_at: at(today, "14:00"), ends_at: at(today, "16:00") });
    const groups = groupEvents([later, cancelled, happening], now);

    expect(groups.coming.map(({ id }) => id)).toEqual(["now", "cancelled", "later"]);
  });

  it("lists drafts by when they'd start, and past events most recent first", () => {
    const on = (date: string) => ({ starts_at: at(date, "19:00"), ends_at: at(date, "21:00") });
    const events = [
      event({ id: "draft-later", status: "draft", ...on("2026-12-01") }),
      event({ id: "draft-sooner", status: "draft" }),
      event({ id: "older", ...on("2026-09-01") }),
      event({ id: "newer", status: "cancelled", ...on("2026-10-01") }),
    ];
    const groups = groupEvents(events, now);

    expect(groups.draft.map(({ id }) => id)).toEqual(["draft-sooner", "draft-later"]);
    expect(groups.past.map(({ id }) => id)).toEqual(["newer", "older"]);
  });
});

describe("whenLabel", () => {
  it("names the day and the times of a one-day event", () => {
    expect(whenLabel(event({ id: "a" }), today)).toBe("Sat, Nov 14 · 7–9 PM");
  });

  it("says All day for a one-day all-day event", () => {
    const allDay = event({
      id: "a",
      all_day: true,
      starts_at: laMidnight("2026-11-14").toISOString(),
      ends_at: laMidnight("2026-11-15").toISOString(),
    });

    expect(whenLabel(allDay, today)).toBe("Sat, Nov 14 · All day");
  });

  it("gives the first and last day of a longer all-day event", () => {
    const retreat = event({
      id: "a",
      all_day: true,
      starts_at: laMidnight("2026-10-30").toISOString(),
      ends_at: laMidnight("2026-11-02").toISOString(),
    });

    expect(whenLabel(retreat, today)).toBe("Fri, Oct 30 – Sun, Nov 1");
  });

  it("gives both days and times of a timed event over more than one day", () => {
    const retreat = event({ id: "a", starts_at: at("2026-10-30", "17:00"), ends_at: at("2026-11-01", "12:00") });

    expect(whenLabel(retreat, today)).toBe("Fri, Oct 30, 5 PM – Sun, Nov 1, 12 PM");
  });

  it("adds the year when it isn't this year", () => {
    const next = event({ id: "a", starts_at: at("2027-01-09", "19:00"), ends_at: at("2027-01-09", "21:00") });

    expect(whenLabel(next, today)).toMatch(/^Sat, Jan 9, 2027 · 7–9 PM$/);
  });
});

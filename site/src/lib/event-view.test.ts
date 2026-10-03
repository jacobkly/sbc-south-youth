import { describe, expect, it } from "vitest";
import type { SiteEvent } from "./content/types";
import { eventDescription, oneOffEventView } from "./event-view";

const view = { date: "Friday, October 16", time: "5 PM", locationName: "Camp Example" };

describe("eventDescription", () => {
  it("gives the facts, then the short description", () => {
    expect(eventDescription({ ...view, summary: "Three days away." })).toBe(
      "Friday, October 16 · 5 PM · Camp Example. Three days away.",
    );
  });

  it("is only the facts without a short description", () => {
    expect(eventDescription(view)).toBe("Friday, October 16 · 5 PM · Camp Example");
  });

  it("says first when it's called off", () => {
    expect(eventDescription({ ...view, cancelled: {}, summary: "Three days away." })).toBe(
      "Cancelled · Friday, October 16 · 5 PM · Camp Example. Three days away.",
    );
  });
});

describe("oneOffEventView", () => {
  const church = "100 Example Way, Maple Valley, WA 98000";
  const event: SiteEvent = {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "fall-retreat",
    title: "Fall Retreat",
    summary: "Three days away.",
    description: "Bring a sleeping bag.",
    // 5 PM Friday to noon Sunday, Los Angeles time.
    startsAt: "2026-10-17T00:00:00.000Z",
    endsAt: "2026-10-18T19:00:00.000Z",
    allDay: false,
    locationName: "Camp Example",
    locationAddress: "1 Camp Road, Example, WA",
    costNote: "$40",
    featured: true,
    sequence: 0,
  };
  const before = new Date("2026-10-03T19:00:00Z");

  it("gives the page its dates, place, and calendar link", () => {
    const view = oneOffEventView(event, before, church);
    expect(view).toMatchObject({
      slug: "fall-retreat",
      title: "Fall Retreat",
      weekly: false,
      featured: true,
      date: "Fri, Oct 16 – Sun, Oct 18",
      time: "Fri 5 PM – Sun 12 PM",
      locationName: "Camp Example",
      address: "1 Camp Road, Example, WA",
      costNote: "$40",
      ended: false,
      nights: [],
      today: "2026-10-03",
    });
    expect(view.googleCalendar).toMatch(/^https:\/\/calendar\.google\.com\//);
    expect(view.cancelled).toBeUndefined();
  });

  it("uses the church's address for a room there", () => {
    const view = oneOffEventView({ ...event, locationName: "Youth room", locationAddress: undefined }, before, church);
    expect(view.address).toBe(church);
  });

  it("knows when it already happened", () => {
    expect(oneOffEventView(event, new Date("2026-10-19T00:00:00Z"), church).ended).toBe(true);
  });

  it("carries the reason when it's called off", () => {
    expect(oneOffEventView({ ...event, cancelled: { reason: "Snow." } }, before, church).cancelled).toEqual({
      reason: "Snow.",
    });
  });
});

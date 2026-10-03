import { describe, expect, it } from "vitest";
import type { FeedItem } from "./feed";
import { eventJsonLd, jsonLdScript } from "./json-ld";

const FILES = "https://example.supabase.co/storage/v1/object/public/site-photos/00000000-0000-4000-8000-0000000f0002";

const retreat: FeedItem = {
  kind: "event",
  key: "e1",
  slug: "fall-retreat",
  title: "Fall Retreat",
  startsAt: "2026-10-09T23:00:00.000Z",
  endsAt: "2026-10-11T19:00:00.000Z",
  date: "2026-10-09",
  allDay: false,
  locationName: "Camp Example",
  locationAddress: "1 Camp Road, Anytown, CA 00000",
  photo: {
    src: `${FILES}/lg.jpg`,
    srcSet: `${FILES}/sm.jpg 480w, ${FILES}/lg.jpg 1200w`,
    alt: "A cabin",
  },
  featured: true,
};

describe("eventJsonLd", () => {
  it("describes a timed event with its place and photo", () => {
    const data = eventJsonLd(retreat, { description: "Three days away.", address: "1 Camp Road, Anytown, CA 00000" });
    expect(data).toMatchObject({
      "@type": "Event",
      name: "Fall Retreat",
      description: "Three days away.",
      startDate: "2026-10-09T23:00:00.000Z",
      endDate: "2026-10-11T19:00:00.000Z",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: { "@type": "Place", name: "Camp Example", address: "1 Camp Road, Anytown, CA 00000" },
      image: [retreat.photo!.src],
      url: "https://sbcsouthyouth.com/events/fall-retreat",
    });
  });

  it("uses plain dates for an all-day event, ending on its last day", () => {
    const allDay = {
      ...retreat,
      allDay: true,
      date: "2026-10-10",
      startsAt: "2026-10-10T07:00:00.000Z",
      endsAt: "2026-10-11T07:00:00.000Z",
    };
    expect(eventJsonLd(allDay, { address: "x" })).toMatchObject({ startDate: "2026-10-10", endDate: "2026-10-10" });
  });

  it("leaves out the place, photo, and description when there aren't any", () => {
    const bare = { ...retreat, locationName: undefined, locationAddress: undefined, photo: undefined };
    const data = eventJsonLd(bare, {});
    expect(data).not.toHaveProperty("location");
    expect(data).not.toHaveProperty("image");
    expect(data).not.toHaveProperty("description");
  });

  it("says when an event is cancelled, and that it's on otherwise", () => {
    expect(eventJsonLd(retreat, { cancelled: true }).eventStatus).toBe("https://schema.org/EventCancelled");
    expect(eventJsonLd(retreat, {}).eventStatus).toBe("https://schema.org/EventScheduled");
  });
});

describe("jsonLdScript", () => {
  it("escapes < so the text can't close the script tag", () => {
    const script = jsonLdScript({ name: "</script><script>alert(1)</script>" });
    expect(script).not.toContain("<");
    expect(JSON.parse(script)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
});

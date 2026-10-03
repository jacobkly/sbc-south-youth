import { describe, expect, it } from "vitest";
import { announcementFromRow, eventFromRow, type EventRow, type PostRow } from "./rows";
import type { SiteEvent } from "./types";

const files = "https://example.supabase.co/storage/v1/object/public/site-photos/00000000-0000-4000-8000-0000000f0002";
const photo = { src: `${files}/lg.jpg`, srcSet: `${files}/sm.jpg 480w, ${files}/lg.jpg 1200w`, alt: "A cabin" };

// The way PostgREST sends a row: every column present, empty ones null.
const retreatRow: EventRow = {
  id: "00000000-0000-4000-8000-00000000e001",
  slug: "fall-retreat",
  title: "Fall Retreat",
  summary: "Three days away.",
  body: "Worship around the fire.\n\nWe leave Friday after school.",
  starts_at: "2026-10-16T17:00:00+00:00",
  ends_at: "2026-10-18T19:00:00+00:00",
  all_day: false,
  location_name: "Camp Example",
  address: "1 Camp Road, Anytown, WA 00000",
  cost_note: "$40 per student",
  featured: true,
  status: "published",
  cancel_reason: null,
  sequence: 2,
  updated_at: "2026-10-01T20:00:00+00:00",
};

const postRow: PostRow = {
  id: "00000000-0000-4000-8000-00000000d001",
  title: "Retreat signups are open",
  body: "Spots are limited, so sign up soon.",
  link_url: "/events/fall-retreat",
  link_label: "See the retreat",
  tone: "info",
  pinned: true,
  starts_at: "2026-10-01T16:00:00+00:00",
  ends_at: "2026-10-16T17:00:00+00:00",
};

describe("eventFromRow", () => {
  it("maps every column the pages show", () => {
    expect(eventFromRow(retreatRow)).toEqual({
      id: "00000000-0000-4000-8000-00000000e001",
      slug: "fall-retreat",
      title: "Fall Retreat",
      summary: "Three days away.",
      description: "Worship around the fire.\n\nWe leave Friday after school.",
      startsAt: "2026-10-16T17:00:00.000Z",
      endsAt: "2026-10-18T19:00:00.000Z",
      allDay: false,
      locationName: "Camp Example",
      locationAddress: "1 Camp Road, Anytown, WA 00000",
      costNote: "$40 per student",
      featured: true,
      sequence: 2,
    });
  });

  it("leaves out empty and blank columns instead of passing null along", () => {
    const event = eventFromRow({
      ...retreatRow,
      summary: " ",
      body: "  ",
      location_name: null,
      address: null,
      cost_note: "",
    });
    expect(event).not.toHaveProperty("summary");
    expect(event).not.toHaveProperty("description");
    expect(event).not.toHaveProperty("locationName");
    expect(event).not.toHaveProperty("locationAddress");
    expect(event).not.toHaveProperty("costNote");
  });

  it("keeps an all-day event's midnights as instants", () => {
    const event = eventFromRow({
      ...retreatRow,
      all_day: true,
      starts_at: "2026-10-24T07:00:00+00:00",
      ends_at: "2026-10-25T07:00:00+00:00",
    });
    expect(event).toMatchObject({ allDay: true, startsAt: "2026-10-24T07:00:00.000Z", endsAt: "2026-10-25T07:00:00.000Z" });
  });

  it("marks a cancelled event, with its reason when there is one", () => {
    expect(eventFromRow({ ...retreatRow, status: "cancelled", cancel_reason: "Not enough signups." }).cancelled).toEqual({
      reason: "Not enough signups.",
    });
    expect(eventFromRow({ ...retreatRow, status: "cancelled" }).cancelled).toEqual({});
    expect(eventFromRow(retreatRow)).not.toHaveProperty("cancelled");
  });

  it("adds a photo when it's given one", () => {
    expect(eventFromRow(retreatRow, photo).photo).toEqual(photo);
    expect(eventFromRow(retreatRow)).not.toHaveProperty("photo");
  });
});

describe("announcementFromRow", () => {
  const retreat: SiteEvent = { ...eventFromRow(retreatRow), photo };

  it("maps a heads-up and its link", () => {
    expect(announcementFromRow(postRow, [])).toEqual({
      id: "00000000-0000-4000-8000-00000000d001",
      title: "Retreat signups are open",
      body: "Spots are limited, so sign up soon.",
      pinned: true,
      publishAt: "2026-10-01T16:00:00.000Z",
      expiresAt: "2026-10-16T17:00:00.000Z",
      cta: { label: "See the retreat", href: "/events/fall-retreat" },
    });
  });

  it("borrows the photo of the event it links to", () => {
    expect(announcementFromRow(postRow, [retreat]).photo).toEqual(photo);
    expect(announcementFromRow({ ...postRow, link_url: "/events/fall-retreat/calendar.ics" }, [retreat])).not.toHaveProperty(
      "photo",
    );
    expect(announcementFromRow({ ...postRow, link_url: "/events/other" }, [retreat])).not.toHaveProperty("photo");
  });

  it("names a link that has no label, and leaves out a missing one", () => {
    expect(announcementFromRow({ ...postRow, link_label: null }, []).cta).toEqual({
      label: "Learn more",
      href: "/events/fall-retreat",
    });
    expect(announcementFromRow({ ...postRow, link_url: null, link_label: null }, [])).not.toHaveProperty("cta");
  });

  it("keeps an outside link as it is", () => {
    const cta = announcementFromRow({ ...postRow, link_url: "https://example.com/merch", link_label: "Shop" }, []).cta;
    expect(cta).toEqual({ label: "Shop", href: "https://example.com/merch" });
  });

  it("marks a change of plans, and only that", () => {
    expect(announcementFromRow({ ...postRow, tone: "cancellation" }, []).changeOfPlans).toBe(true);
    expect(announcementFromRow(postRow, [])).not.toHaveProperty("changeOfPlans");
  });
});

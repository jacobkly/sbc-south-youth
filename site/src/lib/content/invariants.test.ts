import { describe, expect, it } from "vitest";
import { sampleAnnouncements } from "@/content/announcements";
import { sampleEvents } from "@/content/events";
import { moreItems } from "@/components/site/nav-items";
import { visitFaq } from "@/content/faq";
import { give } from "@/content/give";
import { leaders } from "@/content/leaders";
import { photos } from "@/content/photos";
import { privacy } from "@/content/privacy";
import { safety } from "@/content/safety";
import { gatherings } from "@/content/schedule";
import { site } from "@/content/site";
import { standingNotes } from "@/content/standing-notes";
import { visit } from "@/content/visit";
import { addDays, laInstant } from "@/lib/dates";
import { upcomingItems } from "@/lib/feed";
import { contentProblems } from "./invariants";
import type { Announcement, Leader, SiteEvent, WeeklyGathering } from "./types";

const photo = { src: "https://images.unsplash.com/photo-1", alt: "A campfire at night", placeholder: true };

const gathering: WeeklyGathering = {
  slug: "weekly-youth-night",
  title: "Youth Night",
  weekday: 5,
  startTime: "19:30",
  endTime: "21:00",
  description: "Worship and a message, then food and hanging out.",
};

const event: SiteEvent = {
  id: "e1",
  slug: "fall-retreat",
  title: "Fall Retreat",
  startsAt: "2026-10-16T17:00:00-07:00",
  endsAt: "2026-10-18T12:00:00-07:00",
  allDay: false,
  featured: true,
  photo,
};

const announcement: Announcement = {
  id: "a1",
  title: "No youth night on the 31st",
  body: "We're at the fall festival instead.",
  pinned: true,
  publishAt: "2026-10-20T09:00:00-07:00",
  expiresAt: "2026-11-01T00:00:00-07:00",
};

const leader: Leader = { slug: "sam", name: "Sam", role: "Youth pastor", bio: "Bio.", funFact: "Fact." };

describe("contentProblems", () => {
  it("passes the site's own content", () => {
    expect(
      contentProblems({
        gatherings,
        leaders,
        faq: visitFaq,
        photos: [
          ...Object.values(photos),
          visit.parking.entrancePhoto,
          safety.dropOff.photo,
          ...standingNotes.flatMap((note) => note.photo ?? []),
        ],
        extra: [site, visit, safety, privacy, standingNotes],
      }),
    ).toEqual([]);
  });

  it("passes the sample events and announcements on every day of the week", () => {
    for (let offset = 0; offset < 7; offset++) {
      const now = laInstant(addDays("2026-09-28", offset), "12:00");
      expect(contentProblems({ gatherings, events: sampleEvents(now), announcements: sampleAnnouncements(now) })).toEqual(
        [],
      );
    }
  });

  it("keeps the sample events off youth night", () => {
    const now = laInstant("2026-09-28", "12:00");
    // Every weekly night from before the first sample event to past the last.
    const nights = upcomingItems({ gatherings, events: [], now: laInstant("2026-09-14", "00:00"), days: 120 });
    const overlaps = (a: { startsAt: string; endsAt: string }, b: { startsAt: string; endsAt: string }) =>
      Date.parse(a.startsAt) < Date.parse(b.endsAt) && Date.parse(b.startsAt) < Date.parse(a.endsAt);
    const clashes = sampleEvents(now).filter((event) => nights.some((night) => overlaps(event, night)));
    expect(clashes.map((event) => event.slug)).toEqual([]);
  });

  it("keeps the sample calendar light but still shows every kind of event", () => {
    const now = laInstant("2026-09-28", "12:00");
    const events = sampleEvents(now);
    const day = 24 * 60 * 60 * 1000;
    const kinds = {
      past: events.some((event) => Date.parse(event.endsAt) < now.getTime()),
      allDay: events.some((event) => event.allDay),
      multiDay: events.some((event) => Date.parse(event.endsAt) - Date.parse(event.startsAt) > day),
      pastTheAgenda: events.some((event) => Date.parse(event.startsAt) > now.getTime() + 56 * day),
      featuredPhoto: events.some((event) => event.featured && event.photo),
      generatedArt: events.some((event) => !event.photo),
      costNote: events.some((event) => event.costNote),
      volleyball: events.some((event) => /volleyball/i.test(event.title)),
    };
    expect(kinds).toEqual(Object.fromEntries(Object.keys(kinds).map((kind) => [kind, true])));
    expect(upcomingItems({ gatherings: [], events, now }).length).toBeLessThanOrEqual(6);
  });

  it("keeps a pinned, a scheduled, and an expired sample post", () => {
    const now = laInstant("2026-09-28", "12:00");
    const posts = sampleAnnouncements(now);
    expect(posts.some((post) => post.pinned)).toBe(true);
    expect(posts.some((post) => Date.parse(post.publishAt) > now.getTime())).toBe(true);
    expect(posts.some((post) => Date.parse(post.expiresAt) < now.getTime())).toBe(true);
    expect(posts.map((post) => post.title).join(" ")).toMatch(/hoodies/i);
    expect(posts.map((post) => post.title).join(" ")).not.toMatch(/shirts|bring a friend/i);
  });

  it("keeps the safety page to what the church actually does", () => {
    const text = JSON.stringify(safety);
    expect(text).not.toMatch(/screen|background check|trained|training|side entrance|meeting up|rides and/i);
    const points = [...Object.values(safety.commitment), ...Object.values(safety.communication)];
    expect(points.filter((point) => !point.confirmed).map((point) => point.title)).toEqual([]);
  });

  it("keeps giving to what the money really pays for", () => {
    const text = JSON.stringify([give, moreItems]);
    expect(text).not.toMatch(/\bcamps?\b|scholarship|\btrips?\b/i);
    expect(give.impact.map((item) => item.title).join(" ")).toMatch(/friday/i);
    expect(give.impact.map((item) => item.title).join(" ")).toMatch(/birthday/i);
    expect(give.impact.map((item) => item.title).join(" ")).toMatch(/volleyball/i);
  });

  it("passes a good fixture", () => {
    expect(
      contentProblems({ gatherings: [gathering], events: [event], announcements: [announcement], leaders: [leader] }),
    ).toEqual([]);
  });

  it("catches a duplicate slug, even across events and gatherings", () => {
    const twin = { ...event, id: "e2" };
    expect(contentProblems({ events: [event, twin] })).toContainEqual(expect.stringMatching(/fall-retreat.*used twice/));
    const clash = { ...gathering, slug: "weekly-youth-night" };
    expect(contentProblems({ gatherings: [gathering, clash] })).toContainEqual(expect.stringMatching(/used twice/));
  });

  it("keeps the weekly- prefix for gatherings", () => {
    expect(contentProblems({ events: [{ ...event, slug: "weekly-bonus" }] })).toContainEqual(
      expect.stringMatching(/weekly-/),
    );
    expect(contentProblems({ gatherings: [{ ...gathering, slug: "hs-night" }] })).toContainEqual(
      expect.stringMatching(/weekly-/),
    );
  });

  it("catches a slug that isn't lowercase words and dashes", () => {
    expect(contentProblems({ events: [{ ...event, slug: "Fall Retreat" }] })).toContainEqual(
      expect.stringMatching(/slug/),
    );
  });

  it("catches a photo without alt text", () => {
    expect(contentProblems({ events: [{ ...event, photo: { ...photo, alt: "  " } }] })).toContainEqual(
      expect.stringMatching(/alt text/),
    );
    expect(contentProblems({ photos: [{ ...photo, alt: "" }] })).toContainEqual(expect.stringMatching(/alt text/));
  });

  it("catches an announcement that expires before it publishes", () => {
    const backwards = { ...announcement, expiresAt: announcement.publishAt };
    expect(contentProblems({ announcements: [backwards] })).toContainEqual(expect.stringMatching(/expires/));
  });

  it("catches an event that ends before it starts", () => {
    const backwards = { ...event, endsAt: "2026-10-16T16:00:00-07:00" };
    expect(contentProblems({ events: [backwards] })).toContainEqual(expect.stringMatching(/ends before/));
  });

  it("catches an instant without an offset", () => {
    const floating = { ...event, startsAt: "2026-10-16T17:00:00" };
    expect(contentProblems({ events: [floating] })).toContainEqual(expect.stringMatching(/offset/));
  });

  it("catches text over the database limits", () => {
    const long = { ...announcement, title: "x".repeat(61), cta: { label: "y".repeat(25), href: "/visit" } };
    const problems = contentProblems({ announcements: [long] });
    expect(problems).toContainEqual(expect.stringMatching(/title.*60/));
    expect(problems).toContainEqual(expect.stringMatching(/label.*24/));
  });

  it("catches a gathering with a bad day or time", () => {
    expect(contentProblems({ gatherings: [{ ...gathering, weekday: 7 }] })).toContainEqual(
      expect.stringMatching(/weekday/),
    );
    expect(contentProblems({ gatherings: [{ ...gathering, endTime: "18:30" }] })).toContainEqual(
      expect.stringMatching(/ends before/),
    );
    expect(contentProblems({ gatherings: [{ ...gathering, startTime: "7pm" }] })).toContainEqual(
      expect.stringMatching(/time/),
    );
  });

  it("catches a duplicate leader", () => {
    expect(contentProblems({ leaders: [leader, leader] })).toContainEqual(expect.stringMatching(/used twice/));
  });

  it("refuses a group chat invite link anywhere", () => {
    const leak = { ...announcement, cta: { label: "Join", href: "https://chat.whatsapp.com/AbC123" } };
    expect(contentProblems({ announcements: [leak] })).toContainEqual(expect.stringMatching(/chat invite/));
    expect(contentProblems({ extra: { note: "ask for https://groupme.com/join_group/1/x" } })).toContainEqual(
      expect.stringMatching(/chat invite/),
    );
  });
});

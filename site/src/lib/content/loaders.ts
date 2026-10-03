import { cacheLife, cacheTag } from "next/cache";
import { seedEventPhotos } from "@/content/events";
import { gatherings } from "@/content/schedule";
import { publicEvents, publicPosts } from "@/lib/supabase/admin";
import { readOrNothing } from "./read";
import { announcementFromRow, eventFromRow } from "./rows";
import type { Announcement, SiteEvent, WeeklyGathering } from "./types";

/**
 * The one door pages use to get the schedule, events, and heads-ups. The
 * weekly nights live in code. Events and heads-ups come from the database
 * through `site.public_*()`, cached with the feed and tagged so a portal
 * change can refresh them right away.
 */

/** The weekly nights, in week order starting Sunday. */
export async function getSchedule(): Promise<WeeklyGathering[]> {
  return [...gatherings].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
}

/** Every published or cancelled event, past and future, soonest first. */
export async function getEvents(): Promise<SiteEvent[]> {
  "use cache";
  cacheTag("events");
  const rows = await readOrNothing("events", publicEvents);
  if (!rows) {
    // Nothing, after a failed read, is tried again sooner.
    cacheLife("minutes");
    return [];
  }
  cacheLife("feed");
  return rows.map((row) => eventFromRow(row, seedEventPhotos[row.id]));
}

/** What an `/events/[slug]` page shows: a one-off event or a weekly night. */
export type EventPageContent = { kind: "event"; event: SiteEvent } | { kind: "gathering"; gathering: WeeklyGathering };

/** The event or weekly night with this slug, or null. */
export async function getBySlug(slug: string): Promise<EventPageContent | null> {
  const [gatherings, events] = await Promise.all([getSchedule(), getEvents()]);
  const gathering = gatherings.find((entry) => entry.slug === slug);
  if (gathering) return { kind: "gathering", gathering };
  const event = events.find((entry) => entry.slug === slug);
  return event ? { kind: "event", event } : null;
}

/** Every slug with an `/events/[slug]` page, weekly nights first. */
export async function getEventSlugs(): Promise<string[]> {
  const [gatherings, events] = await Promise.all([getSchedule(), getEvents()]);
  return [...gatherings, ...events].map((entry) => entry.slug);
}

/**
 * The heads-ups showing now, pinned first. One that links to an event
 * borrows its photo, so they refresh with the events too.
 */
export async function getAnnouncements(): Promise<Announcement[]> {
  "use cache";
  cacheTag("posts", "events");
  const [rows, events] = await Promise.all([readOrNothing("heads-ups", publicPosts), getEvents()]);
  if (!rows) {
    cacheLife("minutes");
    return [];
  }
  cacheLife("feed");
  return rows.map((row) => announcementFromRow(row, events));
}

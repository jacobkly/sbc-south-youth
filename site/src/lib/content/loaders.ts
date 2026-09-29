import { cacheLife } from "next/cache";
import { sampleAnnouncements } from "@/content/announcements";
import { sampleEvents } from "@/content/events";
import { gatherings } from "@/content/schedule";
import type { Announcement, SiteEvent, WeeklyGathering } from "./types";

/**
 * The one door pages use to get the schedule, events, and announcements.
 * They come from repo files for now. The portal will swap these bodies
 * for database reads without touching any page.
 */

/** The weekly nights, in week order starting Sunday. */
export async function getSchedule(): Promise<WeeklyGathering[]> {
  return [...gatherings].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
}

/**
 * Every event, past and future, in no particular order. The samples move
 * with the calendar, so they refresh with the feed.
 */
export async function getEvents(): Promise<SiteEvent[]> {
  "use cache";
  cacheLife("feed");
  return sampleEvents(new Date());
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

/** Every announcement, including scheduled and expired ones. */
export async function getAnnouncements(): Promise<Announcement[]> {
  "use cache";
  cacheLife("feed");
  return sampleAnnouncements(new Date());
}

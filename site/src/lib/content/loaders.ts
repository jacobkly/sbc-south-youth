import { cacheLife, cacheTag } from "next/cache";
import { gatherings } from "@/content/schedule";
import { standingNotes } from "@/content/standing-notes";
import { publicEvents, publicPhotos, publicPosts } from "@/lib/supabase/admin";
import { supabaseEnv } from "@/lib/supabase/env";
import { placedPhotos, type PlacedPhotos } from "./photos";
import { readOrNothing } from "./read";
import { announcementFromRow, eventFromRow } from "./rows";
import type { Announcement, SiteEvent, StandingNote, WeeklyGathering } from "./types";

/**
 * The one door pages use to get the schedule, events, heads-ups, and
 * photos. The weekly nights and standing notes live in code. Events,
 * heads-ups, and photos come from the database through `site.public_*()`,
 * cached with the feed and tagged so a portal change can refresh them
 * right away.
 */

/**
 * The photos placed on the site, by spot and by event. An event's cover
 * shows only once the event is published, so they refresh with the events
 * too.
 */
export async function getPhotos(): Promise<PlacedPhotos> {
  "use cache";
  cacheTag("photos", "events");
  const rows = await readOrNothing("photos", publicPhotos);
  if (!rows) {
    // Nothing, after a failed read, is tried again sooner.
    cacheLife("minutes");
    return { spots: {}, covers: {} };
  }
  cacheLife("feed");
  return placedPhotos(rows, supabaseEnv().url);
}

/** The weekly nights, in week order starting Sunday, with their photos. */
export async function getSchedule(): Promise<WeeklyGathering[]> {
  const { spots } = await getPhotos();
  return [...gatherings]
    .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime))
    .map((gathering) => withSpotPhoto(gathering, spots));
}

/** The Heads up notes that are always true, with their photos. */
export async function getStandingNotes(): Promise<StandingNote[]> {
  const { spots } = await getPhotos();
  return standingNotes.map((note) => withSpotPhoto(note, spots));
}

/** The item with its spot's photo, or without a photo while the spot is empty. */
function withSpotPhoto<Item extends WeeklyGathering | StandingNote>(item: Item, spots: PlacedPhotos["spots"]): Item {
  const photo = item.spot && spots[item.spot];
  return photo ? { ...item, photo } : item;
}

/** Every published or cancelled event, past and future, soonest first. */
export async function getEvents(): Promise<SiteEvent[]> {
  "use cache";
  cacheTag("events", "photos");
  const [rows, { covers }] = await Promise.all([readOrNothing("events", publicEvents), getPhotos()]);
  if (!rows) {
    cacheLife("minutes");
    return [];
  }
  cacheLife("feed");
  return rows.map((row) => eventFromRow(row, covers[row.id]));
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
 * borrows its photo, so they refresh with the events and photos too.
 */
export async function getAnnouncements(): Promise<Announcement[]> {
  "use cache";
  cacheTag("posts", "events", "photos");
  const [rows, events] = await Promise.all([readOrNothing("heads-ups", publicPosts), getEvents()]);
  if (!rows) {
    cacheLife("minutes");
    return [];
  }
  cacheLife("feed");
  return rows.map((row) => announcementFromRow(row, events));
}

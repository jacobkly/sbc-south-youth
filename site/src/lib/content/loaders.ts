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

/** Every announcement, including scheduled and expired ones. */
export async function getAnnouncements(): Promise<Announcement[]> {
  "use cache";
  cacheLife("feed");
  return sampleAnnouncements(new Date());
}

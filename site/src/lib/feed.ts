import type { Announcement, Audience, Photo, SiteEvent, WeeklyGathering } from "./content/types";
import {
  addDays,
  daysBetween,
  formatLongDate,
  formatWeekdayDate,
  laDateOf,
  laInstant,
  laTimeOf,
  todayInLA,
  weekdayOf,
  type IsoDate,
} from "./dates";
import { formatClock, formatClockRange, weekdayName } from "./schedule";

/**
 * What's coming up: each weekly night's next dates merged with one-off
 * events, grouped by week, plus the announcements that are live. Every
 * function takes `now`, so pages can cache the result and tests can pin
 * the clock.
 */

/** How far ahead the agenda looks, in days. */
export const AGENDA_DAYS = 56;

/** One night of a weekly gathering, or an event. */
export type FeedItem = {
  kind: "gathering" | "event";
  /** Unique in a feed, like `weekly-hs@2026-09-30` or an event id. */
  key: string;
  /** The `/events/[slug]` page. */
  slug: string;
  title: string;
  audience: Audience;
  /** UTC instants. */
  startsAt: string;
  endsAt: string;
  /** The Los Angeles date it starts on. */
  date: IsoDate;
  allDay: boolean;
  locationName?: string;
  /** Left out for rooms at the church. */
  locationAddress?: string;
  photo?: Photo;
  costNote?: string;
  featured: boolean;
};

/** Every night of a gathering from one date through another. */
function gatheringNights(gathering: WeeklyGathering, from: IsoDate, through: IsoDate): FeedItem[] {
  const nights: FeedItem[] = [];
  const offset = (gathering.weekday - weekdayOf(from) + 7) % 7;
  for (let date = addDays(from, offset); date <= through; date = addDays(date, 7)) {
    nights.push({
      kind: "gathering",
      key: `${gathering.slug}@${date}`,
      slug: gathering.slug,
      title: gathering.title,
      audience: gathering.audience,
      // From the wall clock each night, so 7 PM stays 7 PM across DST.
      startsAt: laInstant(date, gathering.startTime).toISOString(),
      endsAt: laInstant(date, gathering.endTime).toISOString(),
      date,
      allDay: false,
      locationName: gathering.locationName,
      photo: gathering.photo,
      featured: false,
    });
  }
  return nights;
}

/** An event as it shows on the agenda. */
export function eventItem(event: SiteEvent): FeedItem {
  return {
    kind: "event",
    key: event.id,
    slug: event.slug,
    title: event.title,
    audience: event.audience,
    startsAt: new Date(event.startsAt).toISOString(),
    endsAt: new Date(event.endsAt).toISOString(),
    date: laDateOf(event.startsAt),
    allDay: event.allDay,
    locationName: event.locationName,
    locationAddress: event.locationAddress,
    photo: event.photo,
    costNote: event.costNote,
    featured: event.featured,
  };
}

/**
 * Everything that hasn't ended yet and starts within `days` days of
 * today, soonest first. Something that ends exactly now is over.
 */
export function upcomingItems({
  gatherings,
  events,
  now,
  days = AGENDA_DAYS,
}: {
  gatherings: WeeklyGathering[];
  events: SiteEvent[];
  now: Date;
  days?: number;
}): FeedItem[] {
  const today = todayInLA(now);
  const lastDay = addDays(today, days);
  const items = [
    ...gatherings.flatMap((gathering) => gatheringNights(gathering, today, lastDay)),
    ...events.map(eventItem),
  ];
  return items
    .filter((item) => Date.parse(item.endsAt) > now.getTime() && item.date <= lastDay)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.title.localeCompare(b.title));
}

/**
 * How soon something is: underway, today, tomorrow, or later (""). The
 * feed script works this out again in the browser, since cached pages
 * outlive the day they were made.
 */
export type RelativeDay = "now" | "today" | "tomorrow" | "";

export function relativeDay(item: FeedItem, now: Date): RelativeDay {
  if (Date.parse(item.startsAt) <= now.getTime()) return "now";
  const today = todayInLA(now);
  if (item.date === today) return "today";
  return item.date === addDays(today, 1) ? "tomorrow" : "";
}

/** What to call each `RelativeDay`, like "Tonight" or "Wednesday". */
export type WhenLabels = { now: string; today: string; tomorrow: string; later: string };

/** "Tonight" for plans that start at 5 PM or later. A week or more out, the date. */
export function whenLabels(item: FeedItem, today: IsoDate): WhenLabels {
  const evening = !item.allDay && laTimeOf(item.startsAt) >= "17:00";
  return {
    now: "Happening now",
    today: evening ? "Tonight" : "Today",
    tomorrow: evening ? "Tomorrow night" : "Tomorrow",
    later:
      daysBetween(today, item.date) < 7 ? weekdayName(weekdayOf(item.date)) : formatWeekdayDate(item.date, today),
  };
}

/** Where to get directions to: its own address, or the church's for a room there. */
export function itemAddress(item: FeedItem, churchAddress: string): string | undefined {
  return item.locationAddress ?? (item.locationName ? churchAddress : undefined);
}

export type AgendaDay = { date: IsoDate; items: FeedItem[] };
export type AgendaGroup = {
  id: "this-week" | "next-week" | "coming-up";
  title: string;
  /** The span it covers. Coming up has no set end. */
  from: IsoDate;
  through: IsoDate | null;
  days: AgendaDay[];
};

/**
 * Splits upcoming items into This week (today through Sunday), Next week,
 * and Coming up, each broken into days. Something already underway sits
 * under today. Coming up skips weekly nights, which would otherwise fill
 * it with the same thing every week. Empty groups are left out.
 */
export function groupAgenda(items: FeedItem[], now: Date): AgendaGroup[] {
  const today = todayInLA(now);
  const thisSunday = addDays(today, (7 - weekdayOf(today)) % 7);
  const nextSunday = addDays(thisSunday, 7);
  const groups: AgendaGroup[] = [
    { id: "this-week", title: "This week", from: today, through: thisSunday, days: [] },
    { id: "next-week", title: "Next week", from: addDays(thisSunday, 1), through: nextSunday, days: [] },
    { id: "coming-up", title: "Coming up", from: addDays(nextSunday, 1), through: null, days: [] },
  ];

  for (const item of items) {
    const date = item.date < today ? today : item.date;
    const group = groups[date <= thisSunday ? 0 : date <= nextSunday ? 1 : 2];
    if (group.id === "coming-up" && item.kind === "gathering") continue;
    const day = group.days.find((entry) => entry.date === date);
    if (day) day.items.push(item);
    else group.days.push({ date, items: [item] });
  }

  for (const group of groups) group.days.sort((a, b) => a.date.localeCompare(b.date));
  return groups.filter((group) => group.days.length > 0);
}

const shortDay = (date: IsoDate) => weekdayName(weekdayOf(date)).slice(0, 3);

/** The last day it runs into. An all-day event ends at midnight after it. */
function lastDayOf(item: FeedItem): IsoDate {
  return item.allDay ? addDays(laDateOf(item.endsAt), -1) : laDateOf(item.endsAt);
}

/** Which day, like "Saturday, October 10", or "Fri, Oct 9 – Sun, Oct 11". */
export function itemDateLabel(item: FeedItem, today: IsoDate): string {
  const lastDay = lastDayOf(item);
  if (lastDay <= item.date) return formatLongDate(item.date, today);
  return `${formatWeekdayDate(item.date, today)} – ${formatWeekdayDate(lastDay, today)}`;
}

/** When it happens, like "7–9 PM", "Fri 5 PM – Sun 12 PM", or "All day". */
export function itemTimeLabel(item: FeedItem): string {
  if (item.allDay) {
    const lastDay = lastDayOf(item);
    return lastDay <= item.date ? "All day" : `All day, ${shortDay(item.date)}–${shortDay(lastDay)}`;
  }
  const endDate = laDateOf(item.endsAt);
  const start = laTimeOf(item.startsAt);
  const end = laTimeOf(item.endsAt);
  if (endDate === item.date) return formatClockRange(start, end);
  return `${shortDay(item.date)} ${formatClock(start)} – ${shortDay(endDate)} ${formatClock(end)}`;
}

/** Announcements that are published and not expired, pinned first, then newest. */
export function liveAnnouncements(announcements: Announcement[], now: Date): Announcement[] {
  const time = now.getTime();
  return announcements
    .filter((item) => Date.parse(item.publishAt) <= time && time < Date.parse(item.expiresAt))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || Date.parse(b.publishAt) - Date.parse(a.publishAt));
}

import { site } from "@/content/site";
import type { SiteEvent, WeeklyGathering } from "./content/types";
import { APP_TIME_ZONE, addDays, laDateOf, todayInLA, weekdayOf, type IsoDate } from "./dates";

/**
 * Calendar files (RFC 5545) and Google Calendar links for events and
 * weekly nights. One-off events use UTC, so they land at the right time
 * anywhere. Weekly nights use LA wall-clock time with a repeat rule, so
 * 7 PM stays 7 PM after daylight saving changes.
 */

export type CalendarEntry = {
  /** Stable and unique, like `event-<id>` or a gathering slug. */
  id: string;
  title: string;
  description?: string;
  location?: string;
  /** The page on this site, added after the description too. */
  url?: string;
  when:
    | { kind: "timed"; start: string; end: string }
    /** The end date is the day after the last day, as calendar files expect. */
    | { kind: "all-day"; start: IsoDate; end: IsoDate }
    /** The first night, and "HH:MM" wall-clock times in LA. */
    | { kind: "weekly"; date: IsoDate; startTime: string; endTime: string };
  /** How many times it's changed. A calendar that has it keeps the copy with the higher one. */
  sequence?: number;
  /** Called off, so a calendar that has it marks it cancelled instead of keeping it as planned. */
  cancelled?: boolean;
};

const CRLF = "\r\n";
const UID_DOMAIN = new URL(site.url).hostname;
const WEEKLY_RULE = "RRULE:FREQ=WEEKLY";

/**
 * LA's daylight saving rules since 2007. The tests check them against
 * the time zone data, so a change in the law shows up as a failure.
 */
const LA_TIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${APP_TIME_ZONE}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0800",
  "TZOFFSETTO:-0700",
  "TZNAME:PDT",
  "DTSTART:20070311T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0700",
  "TZOFFSETTO:-0800",
  "TZNAME:PST",
  "DTSTART:20071104T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** Escapes a TEXT value: backslashes, semicolons, commas, and line breaks. */
export function escapeText(value: string): string {
  return value.replace(/[\\;,]/g, (char) => `\\${char}`).replace(/\r?\n/g, "\\n");
}

function utf8Length(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  return code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
}

/**
 * Splits a line longer than 75 octets. Each continuation starts with a
 * space, which counts toward its 75. Characters are never split.
 */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let part = "";
  let size = 0;
  let limit = 75;
  for (const char of line) {
    const length = utf8Length(char);
    if (size + length > limit) {
      parts.push(part);
      part = "";
      size = 0;
      limit = 74;
    }
    part += char;
    size += length;
  }
  parts.push(part);
  return parts.join(`${CRLF} `);
}

/** "2026-10-10T16:00:00.000Z" -> "20261010T160000Z". */
function utcStamp(instant: string | Date): string {
  return new Date(instant).toISOString().replace(/[-:]|\.\d{3}/g, "");
}

/** "2026-10-17" -> "20261017". */
const compactDate = (date: IsoDate) => date.replace(/-/g, "");

/** A date and "HH:MM" -> "20261028T190000". */
const localStamp = (date: IsoDate, time: string) => `${compactDate(date)}T${time.replace(":", "")}00`;

function descriptionOf(entry: CalendarEntry): string | undefined {
  const parts = [entry.description, entry.url].filter(Boolean);
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

function timeLines(when: CalendarEntry["when"]): string[] {
  switch (when.kind) {
    case "timed":
      return [`DTSTART:${utcStamp(when.start)}`, `DTEND:${utcStamp(when.end)}`];
    case "all-day":
      return [`DTSTART;VALUE=DATE:${compactDate(when.start)}`, `DTEND;VALUE=DATE:${compactDate(when.end)}`];
    case "weekly":
      return [
        `DTSTART;TZID=${APP_TIME_ZONE}:${localStamp(when.date, when.startTime)}`,
        `DTEND;TZID=${APP_TIME_ZONE}:${localStamp(when.date, when.endTime)}`,
        WEEKLY_RULE,
      ];
  }
}

function eventLines(entry: CalendarEntry, stamp: Date): string[] {
  const description = descriptionOf(entry);
  return [
    "BEGIN:VEVENT",
    `UID:${entry.id}@${UID_DOMAIN}`,
    `DTSTAMP:${utcStamp(stamp)}`,
    ...(entry.sequence !== undefined ? [`SEQUENCE:${entry.sequence}`] : []),
    ...(entry.cancelled ? ["STATUS:CANCELLED"] : []),
    ...timeLines(entry.when),
    `SUMMARY:${escapeText(entry.title)}`,
    ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
    ...(entry.location ? [`LOCATION:${escapeText(entry.location)}`] : []),
    ...(entry.url ? [`URL:${entry.url}`] : []),
    "END:VEVENT",
  ];
}

/**
 * A whole calendar file. With a `name`, it's a feed people subscribe to,
 * so it also tells calendar apps what to call it and how often to check.
 */
export function calendarFile(entries: CalendarEntry[], { stamp, name }: { stamp: Date; name?: string }): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${site.name}//Site//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...(name
      ? [
          `X-WR-CALNAME:${escapeText(name)}`,
          `X-WR-TIMEZONE:${APP_TIME_ZONE}`,
          "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
          "X-PUBLISHED-TTL:PT12H",
        ]
      : []),
    ...(entries.some((entry) => entry.when.kind === "weekly") ? LA_TIMEZONE : []),
    ...entries.flatMap((entry) => eventLines(entry, stamp)),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}

/** A link that opens Google Calendar with the event filled in. */
export function googleCalendarUrl(entry: CalendarEntry): string {
  const { when } = entry;
  const query = new URLSearchParams({ action: "TEMPLATE", text: entry.title });
  switch (when.kind) {
    case "timed":
      query.set("dates", `${utcStamp(when.start)}/${utcStamp(when.end)}`);
      break;
    case "all-day":
      query.set("dates", `${compactDate(when.start)}/${compactDate(when.end)}`);
      break;
    case "weekly":
      query.set("dates", `${localStamp(when.date, when.startTime)}/${localStamp(when.date, when.endTime)}`);
      query.set("ctz", APP_TIME_ZONE);
      query.set("recur", WEEKLY_RULE);
      break;
  }
  const description = descriptionOf(entry);
  if (description) query.set("details", description);
  if (entry.location) query.set("location", entry.location);
  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}

/** The public page for an event or weekly night. */
export function eventUrl(slug: string): string {
  return new URL(`/events/${slug}`, site.url).toString();
}

/**
 * Where something is, with an address calendar apps can map. Rooms at
 * the church have no address of their own, so they get the church's.
 */
function placeOf(locationName: string | undefined, address: string | undefined, churchAddress: string) {
  if (!locationName) return address;
  return `${locationName}, ${address ?? churchAddress}`;
}

/**
 * A one-off event. Its UID comes from its id, so it stays the same when
 * the title or slug changes. Not every calendar app shows a cancelled
 * status, so a cancelled event says so in its title too, and gives the
 * reason before the description.
 */
export function eventEntry(event: SiteEvent, churchAddress: string): CalendarEntry {
  const { cancelled } = event;
  const description = [cancelled?.reason, event.description].filter(Boolean).join("\n\n");
  return {
    id: `event-${event.id}`,
    title: cancelled ? `Cancelled: ${event.title}` : event.title,
    ...(description && { description }),
    location: placeOf(event.locationName, event.locationAddress, churchAddress),
    url: eventUrl(event.slug),
    when: event.allDay
      ? { kind: "all-day", start: laDateOf(event.startsAt), end: laDateOf(event.endsAt) }
      : { kind: "timed", start: event.startsAt, end: event.endsAt },
    ...(event.sequence !== undefined && { sequence: event.sequence }),
    ...(cancelled && { cancelled: true }),
  };
}

/** A weekly night, repeating from its next date. */
export function gatheringEntry(gathering: WeeklyGathering, churchAddress: string, now: Date): CalendarEntry {
  const today = todayInLA(now);
  return {
    id: gathering.slug,
    title: gathering.title,
    description: gathering.description,
    location: placeOf(gathering.locationName, churchAddress, churchAddress),
    url: eventUrl(gathering.slug),
    when: {
      kind: "weekly",
      date: addDays(today, (gathering.weekday - weekdayOf(today) + 7) % 7),
      startTime: gathering.startTime,
      endTime: gathering.endTime,
    },
  };
}

/** How long past events stay on subscribers' calendars, in days. */
const KEEP_PAST_DAYS = 30;

/**
 * What the calendar feed lists: the weekly nights, then every event that
 * hasn't ended or ended in the last month, soonest first. A cancelled
 * event stays, marked cancelled, so calendars that already have it update
 * it instead of keeping it as planned.
 */
export function feedEntries(
  gatherings: WeeklyGathering[],
  events: SiteEvent[],
  churchAddress: string,
  now: Date,
): CalendarEntry[] {
  const since = now.getTime() - KEEP_PAST_DAYS * 86_400_000;
  return [
    ...gatherings.map((gathering) => gatheringEntry(gathering, churchAddress, now)),
    ...events
      .filter((event) => Date.parse(event.endsAt) > since)
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      .map((event) => eventEntry(event, churchAddress)),
  ];
}

/**
 * A calendar file response. A single event downloads as a file, which
 * phones open straight into Calendar. A feed is read in place.
 */
export function calendarResponse(file: string, filename: string, disposition: "attachment" | "inline"): Response {
  return new Response(file, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
    },
  });
}

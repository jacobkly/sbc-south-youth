/**
 * Date helpers. The youth group meets in Los Angeles time, so "today",
 * event times, and anything grouped by day use America/Los_Angeles.
 * Plain dates are "YYYY-MM-DD" strings and never shift by time zone.
 */

export const APP_TIME_ZONE = "America/Los_Angeles";

/** A calendar date as "YYYY-MM-DD". */
export type IsoDate = string;

const laDateParts = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const laWallParts = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

const dateLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const monthLabel = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" });

const weekdayLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
});

const weekdayYearLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const longLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
});

const longYearLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const timeLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

function toIsoDate(year: number, month: number, day: number): IsoDate {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

function parseIsoDate(date: IsoDate): { year: number; month: number; day: number } {
  if (!isIsoDate(date)) throw new RangeError(`Invalid date: ${date}`);
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function toInstant(instant: Date | string): Date {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) throw new RangeError(`Invalid instant: ${String(instant)}`);
  return date;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** True for a real calendar date written as "YYYY-MM-DD". */
export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  return month >= 1 && month <= 12 && day >= 1 && day <= lastDayOfMonth(year, month);
}

/** The Los Angeles calendar date of an instant. */
export function laDateOf(instant: Date | string): IsoDate {
  const parts = Object.fromEntries(
    laDateParts.formatToParts(toInstant(instant)).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Today's date in Los Angeles. */
export function todayInLA(now: Date = new Date()): IsoDate {
  return laDateOf(now);
}

/** The date `days` later, or earlier when negative. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const { year, month, day } = parseIsoDate(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return toIsoDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

/** Whole days from one date to another, negative when `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
}

/** The day of the week, from 0 (Sunday) to 6 (Saturday). */
export function weekdayOf(date: IsoDate): number {
  const { year, month, day } = parseIsoDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * The instant when the LA clock reads `time` ("HH:MM", 24-hour) on a
 * date, e.g. `laInstant("2026-09-30", "19:00")` for 7 PM that Wednesday.
 */
export function laInstant(date: IsoDate, time: string): Date {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) throw new RangeError(`Invalid time: ${time}`);
  return laClockTime(date, Number(match[1]), Number(match[2]));
}

/**
 * The start of a date in Los Angeles, as an instant. Daylight saving
 * changes happen at 2 AM, so midnight always exists and never repeats.
 */
export function laMidnight(date: IsoDate): Date {
  return laClockTime(date, 0, 0);
}

/** Formats a plain date, e.g. "2026-09-25" -> "Sep 25, 2026". */
export function formatDate(date: IsoDate): string {
  const { year, month, day } = parseIsoDate(date);
  return dateLabel.format(new Date(Date.UTC(year, month - 1, day)));
}

/** Formats a span of dates, e.g. "Oct 5–11" or "Sep 28 – Oct 4". */
export function formatDateRange(from: IsoDate, through: IsoDate): string {
  const [start, end] = [from, through].map((date) => {
    const { year, month, day } = parseIsoDate(date);
    return { month: monthLabel.format(new Date(Date.UTC(year, month - 1, day))), day };
  });
  if (from === through) return `${start.month} ${start.day}`;
  if (start.month === end.month && from.slice(0, 4) === through.slice(0, 4)) return `${start.month} ${start.day}–${end.day}`;
  return `${start.month} ${start.day} – ${end.month} ${end.day}`;
}

/** Formats a date with its weekday, leaving out this year, e.g. "Fri, Sep 25". */
export function formatWeekdayDate(date: IsoDate, today: IsoDate = todayInLA()): string {
  const { year, month, day } = parseIsoDate(date);
  const format = date.slice(0, 4) === today.slice(0, 4) ? weekdayLabel : weekdayYearLabel;
  return format.format(new Date(Date.UTC(year, month - 1, day)));
}

/** Spells out a date, leaving out this year, e.g. "Saturday, October 10". */
export function formatLongDate(date: IsoDate, today: IsoDate = todayInLA()): string {
  const { year, month, day } = parseIsoDate(date);
  const format = date.slice(0, 4) === today.slice(0, 4) ? longLabel : longYearLabel;
  return format.format(new Date(Date.UTC(year, month - 1, day)));
}

/** The LA wall-clock time of an instant as "HH:MM", 24-hour. */
export function laTimeOf(instant: Date | string): string {
  return new Date(laWallTime(toInstant(instant))).toISOString().slice(11, 16);
}

/** Formats the time of an instant in Los Angeles, e.g. "7:00 PM". */
export function formatTime(instant: Date | string): string {
  return timeLabel.format(toInstant(instant));
}

/**
 * The instant when the LA clock reads the given hour and minute on a date.
 * The first pass uses the offset at the guess, which can be on the other
 * side of a daylight saving change, so the second pass uses the offset at
 * the first answer.
 */
function laClockTime(date: IsoDate, hour: number, minute: number): Date {
  const { year, month, day } = parseIsoDate(date);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offsetAt = (instant: number) => laWallTime(new Date(instant)) - instant;
  const first = guess - offsetAt(guess);
  return new Date(guess - offsetAt(first));
}

/** The LA wall-clock time of an instant, read as if it were UTC. */
function laWallTime(instant: Date): number {
  const parts = Object.fromEntries(
    laWallParts.formatToParts(instant).map((part) => [part.type, Number(part.value)]),
  );
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
}

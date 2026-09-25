/**
 * Date helpers. The ministry runs on Los Angeles time, so "today" and any
 * timestamp shown or grouped by day use America/Los_Angeles. Plain dates
 * (like purchase_date) are "YYYY-MM-DD" strings and never shift by time zone.
 */

export const APP_TIME_ZONE = "America/Los_Angeles";

/** A calendar date as "YYYY-MM-DD". */
export type IsoDate = string;

export type Period =
  | { kind: "month"; year: number; month: number } // month is 1–12
  | { kind: "quarter"; year: number; quarter: number } // quarter is 1–4
  | { kind: "year"; year: number }
  | { kind: "custom"; start: IsoDate; end: IsoDate };

export type PeriodKind = Period["kind"];

/** A month, quarter, or year: a period that has a previous and next one. */
export type CalendarPeriod = Exclude<Period, { kind: "custom" }>;

export type MonthPeriod = Extract<Period, { kind: "month" }>;

/** Inclusive date range. */
export type DateRange = { start: IsoDate; end: IsoDate };

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

const dateTimeLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const monthLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

const monthShortLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
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
  const date = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) throw new RangeError(`Invalid instant: ${String(instant)}`);

  const parts = Object.fromEntries(
    laDateParts.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Today's date in Los Angeles. */
export function todayInLA(now: Date = new Date()): IsoDate {
  return laDateOf(now);
}

/** The inclusive first and last date of a period. */
export function periodRange(period: Period): DateRange {
  switch (period.kind) {
    case "month": {
      const { year, month } = period;
      if (month < 1 || month > 12) throw new RangeError(`Invalid month: ${month}`);
      return { start: toIsoDate(year, month, 1), end: toIsoDate(year, month, lastDayOfMonth(year, month)) };
    }
    case "quarter": {
      const { year, quarter } = period;
      if (quarter < 1 || quarter > 4) throw new RangeError(`Invalid quarter: ${quarter}`);
      const firstMonth = (quarter - 1) * 3 + 1;
      const lastMonth = firstMonth + 2;
      return {
        start: toIsoDate(year, firstMonth, 1),
        end: toIsoDate(year, lastMonth, lastDayOfMonth(year, lastMonth)),
      };
    }
    case "year":
      return { start: toIsoDate(period.year, 1, 1), end: toIsoDate(period.year, 12, 31) };
    case "custom": {
      parseIsoDate(period.start);
      parseIsoDate(period.end);
      if (period.start > period.end) {
        throw new RangeError(`Start ${period.start} is after end ${period.end}`);
      }
      return { start: period.start, end: period.end };
    }
  }
}

/** The month, quarter, or year (calendar year) that contains a date. */
export function periodContaining(kind: CalendarPeriod["kind"], date: IsoDate): CalendarPeriod {
  const { year, month } = parseIsoDate(date);
  switch (kind) {
    case "month":
      return { kind, year, month };
    case "quarter":
      return { kind, year, quarter: Math.ceil(month / 3) };
    case "year":
      return { kind, year };
  }
}

/** The month, quarter, or year `steps` away, e.g. -1 for the one before. */
export function shiftPeriod(period: CalendarPeriod, steps: number): CalendarPeriod {
  switch (period.kind) {
    case "month": {
      const index = period.year * 12 + (period.month - 1) + steps;
      return { kind: "month", year: Math.floor(index / 12), month: (index % 12) + 1 };
    }
    case "quarter": {
      const index = period.year * 4 + (period.quarter - 1) + steps;
      return { kind: "quarter", year: Math.floor(index / 4), quarter: (index % 4) + 1 };
    }
    case "year":
      return { kind: "year", year: period.year + steps };
  }
}

/** The `count` months ending with the month that contains `date`, oldest first. */
export function recentMonths(count: number, date: IsoDate): MonthPeriod[] {
  const { year, month } = parseIsoDate(date);
  const months: MonthPeriod[] = [];
  for (let back = count - 1; back >= 0; back--) {
    const index = year * 12 + (month - 1) - back;
    months.push({ kind: "month", year: Math.floor(index / 12), month: (index % 12) + 1 });
  }
  return months;
}

/** Short month name for chart axes, e.g. "Sep". */
export function monthShortName(period: MonthPeriod): string {
  return monthShortLabel.format(new Date(Date.UTC(period.year, period.month - 1, 1)));
}

/** Human label for a period, e.g. "September 2026", "Q3 2026", "2026". */
export function periodLabel(period: Period): string {
  switch (period.kind) {
    case "month":
      return monthLabel.format(new Date(Date.UTC(period.year, period.month - 1, 1)));
    case "quarter":
      return `Q${period.quarter} ${period.year}`;
    case "year":
      return String(period.year);
    case "custom":
      return `${formatDate(period.start)} – ${formatDate(period.end)}`;
  }
}

/** Formats a plain date for display, e.g. "2026-09-25" -> "Sep 25, 2026". */
export function formatDate(date: IsoDate): string {
  const { year, month, day } = parseIsoDate(date);
  return dateLabel.format(new Date(Date.UTC(year, month - 1, day)));
}

/** Formats an instant in Los Angeles time, e.g. "Sep 25, 2026, 3:04 PM". */
export function formatDateTime(instant: Date | string): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) throw new RangeError(`Invalid instant: ${String(instant)}`);
  return dateTimeLabel.format(date);
}

/** The date `days` later, or earlier when negative. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const { year, month, day } = parseIsoDate(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return toIsoDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

/** An instant as LA "YYYY-MM-DD HH:MM", which spreadsheets read as a date and time. */
export function laDateTime(instant: Date | string): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) throw new RangeError(`Invalid instant: ${String(instant)}`);
  const wall = new Date(laWallTime(date)).toISOString();
  return `${wall.slice(0, 10)} ${wall.slice(11, 16)}`;
}

/** Whole days from one date to another, negative when `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
}

/**
 * Noon in Los Angeles on a date, as an instant. Used when only the day of
 * something is known. Noon is never near a daylight saving change, so it
 * always falls on the same LA date.
 */
export function laNoon(date: IsoDate): Date {
  return laClockTime(date, 12);
}

/**
 * The start of a date in Los Angeles, as an instant. Daylight saving
 * changes happen at 2 AM, so midnight always exists and never repeats.
 */
export function laMidnight(date: IsoDate): Date {
  return laClockTime(date, 0);
}

/** The instant when the LA clock reads the given hour on a date. */
function laClockTime(date: IsoDate, hour: number): Date {
  const { year, month, day } = parseIsoDate(date);
  const guess = Date.UTC(year, month - 1, day, hour);
  const wall = laWallTime(new Date(guess));
  return new Date(guess - (wall - guess));
}

/** The LA wall-clock time of an instant, read as if it were UTC. */
function laWallTime(instant: Date): number {
  const parts = Object.fromEntries(
    laWallParts.formatToParts(instant).map((part) => [part.type, Number(part.value)]),
  );
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
}

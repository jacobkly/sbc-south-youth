import { addDays, formatDate, formatListDate, isIsoDate, type IsoDate } from "@/lib/dates";

/**
 * Cafe weeks run Monday to Sunday and go by the Sunday that ends them. These
 * work on plain dates, so daylight saving time never moves a week. Pass
 * today's date from `todayInLA()`.
 */

/** The first Sunday of 2000, the earliest week the database takes. */
export const FIRST_WEEK_ENDING = "2000-01-02";

/** 0 for Sunday through 6 for Saturday. */
function weekday(date: IsoDate): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** True for a real date that's a Sunday. */
export function isWeekEnding(date: string): boolean {
  return isIsoDate(date) && weekday(date) === 0;
}

/** The Sunday that ends the week a date is in. A Sunday ends its own week. */
export function weekEndingOf(date: IsoDate): IsoDate {
  return addDays(date, (7 - weekday(date)) % 7);
}

/** The Monday a week starts on. */
export function weekStartOf(weekEnding: IsoDate): IsoDate {
  return addDays(weekEnding, -6);
}

/** The latest week that can be entered: this one, which can go in before it ends. */
export function latestWeekEnding(today: IsoDate): IsoDate {
  return weekEndingOf(today);
}

/** The week the cafe sheet opens on: the one that most recently ended, or this one on a Sunday. */
export function defaultWeekEnding(today: IsoDate): IsoDate {
  return weekday(today) === 0 ? today : addDays(weekEndingOf(today), -7);
}

/**
 * A week's dates, like "Oct 5 – 11" or "Sep 28 – Oct 4", with the year when
 * it isn't this year's.
 */
export function weekLabel(weekEnding: IsoDate, today: IsoDate): string {
  const start = weekStartOf(weekEnding);
  const year = weekEnding.slice(0, 4);
  if (start.slice(0, 4) !== year) return `${formatDate(start)} – ${formatDate(weekEnding)}`;

  // Formatting against its own date leaves the year out.
  const end = start.slice(0, 7) === weekEnding.slice(0, 7) ? String(Number(weekEnding.slice(8))) : formatListDate(weekEnding, weekEnding);
  const label = `${formatListDate(start, start)} – ${end}`;
  return year === today.slice(0, 4) ? label : `${label}, ${year}`;
}

/** "This week" or "Last week", or null for an older or later week. */
export function relativeWeekLabel(weekEnding: IsoDate, today: IsoDate): string | null {
  const thisWeek = weekEndingOf(today);
  if (weekEnding === thisWeek) return "This week";
  if (weekEnding === addDays(thisWeek, -7)) return "Last week";
  return null;
}

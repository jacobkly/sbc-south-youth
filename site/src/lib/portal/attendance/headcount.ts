import { addDays, formatWeekdayDate, isIsoDate, weekdayOf, type IsoDate } from "@/lib/dates";

/**
 * The decisions behind each week's headcount at youth, kept apart from the
 * database so each case can be tested. RLS, the check constraint, and the
 * guard_headcount trigger still check everything again, including that a
 * night has only one count.
 */

/** The database's limit on one night's count. */
export const MAX_TOTAL = 1000;

/** One night's count, everyone there, leaders included. */
export type Headcount = { id: string; night: IsoDate; total: number };

/** The form's fields, as it holds them. */
export type HeadcountValues = { night: string; total: string };

export type HeadcountErrors = Partial<Record<keyof HeadcountValues, string>>;

/** A checked count, as the columns the Attendance role can write. */
export type HeadcountFields = Pick<Headcount, "night" | "total">;

export type HeadcountCheck = { ok: true; headcount: HeadcountFields } | { ok: false; errors: HeadcountErrors };

const MESSAGES = {
  night: "Pick the night.",
  future: "Pick a night that's already happened.",
  total: "Enter how many came.",
  whole: "Enter a whole number, like 42.",
  zero: "Enter at least 1.",
  tooMany: `That's more than ${MAX_TOTAL.toLocaleString("en-US")}. Check the number.`,
};

const FRIDAY = 5;

/** How many Fridays back the form looks for one that still needs its count. */
const LOOK_BACK = 8;

/** How many of the latest nights the average covers. */
const AVERAGE_NIGHTS = 8;

function text(source: Record<string, unknown>, key: keyof HeadcountValues): string {
  const value = source[key];
  return typeof value === "string" ? value.trim() : "";
}

/** The night and count to save, or what's wrong with each. Today is the latest night allowed. */
export function checkHeadcount(values: unknown, today: IsoDate): HeadcountCheck {
  const source = values && typeof values === "object" ? (values as Record<string, unknown>) : {};
  const night = text(source, "night");
  const total = text(source, "total").replace(/,/g, "");
  const errors: HeadcountErrors = {};

  if (!isIsoDate(night)) errors.night = MESSAGES.night;
  else if (night > today) errors.night = MESSAGES.future;

  if (!total) errors.total = MESSAGES.total;
  else if (!/^\d+$/.test(total)) errors.total = MESSAGES.whole;
  else if (Number(total) < 1) errors.total = MESSAGES.zero;
  else if (Number(total) > MAX_TOTAL) errors.total = MESSAGES.tooMany;

  if (errors.night || errors.total) return { ok: false, errors };
  return { ok: true, headcount: { night, total: Number(total) } };
}

export type SavePlan =
  | { kind: "invalid"; errors: HeadcountErrors }
  | { kind: "same" }
  | { kind: "write"; row: HeadcountFields };

/** What saving the form writes: a new night when there's no existing count, or a fix to it. */
export function planSave(values: unknown, existing: Headcount | null, today: IsoDate): SavePlan {
  const check = checkHeadcount(values, today);
  if (!check.ok) return { kind: "invalid", errors: check.errors };
  const row = check.headcount;
  if (existing && existing.night === row.night && existing.total === row.total) return { kind: "same" };
  return { kind: "write", row };
}

/** What saving did, in a sentence. */
export function savedMessage(row: HeadcountFields, fixed: boolean, today: IsoDate): string {
  const night = formatWeekdayDate(row.night, today);
  return fixed ? `${night} is now ${row.total}.` : `Saved ${row.total} for ${night}.`;
}

/** The latest Friday, today included. */
export function lastFriday(today: IsoDate): IsoDate {
  return addDays(today, -((weekdayOf(today) - FRIDAY + 7) % 7));
}

/**
 * The night the form starts on: the latest Friday without a count, so
 * catching up on missed weeks is one save after another. When the last
 * eight Fridays all have one, it's the latest Friday.
 */
export function suggestedNight(today: IsoDate, counted: readonly IsoDate[]): IsoDate {
  const latest = lastFriday(today);
  const taken = new Set(counted);
  for (let week = 0; week < LOOK_BACK; week++) {
    const friday = addDays(latest, -7 * week);
    if (!taken.has(friday)) return friday;
  }
  return latest;
}

export type HeadcountSummary = {
  latest: Headcount;
  /** How the latest night compares with the one before it, when there is one. */
  change: { from: Headcount; by: number } | null;
  /** The average of the latest nights, up to eight, to the nearest person. */
  average: { total: number; nights: number };
  /** The most ever counted, the latest night if several tie. */
  highest: Headcount;
};

/** The numbers at the top of the Attendance screen, or null before the first count. */
export function summarize(counts: readonly Headcount[]): HeadcountSummary | null {
  const newest = [...counts].sort((a, b) => (a.night < b.night ? 1 : a.night > b.night ? -1 : 0));
  const [latest, previous] = newest;
  if (!latest) return null;

  const recent = newest.slice(0, AVERAGE_NIGHTS);
  const sum = recent.reduce((total, count) => total + count.total, 0);
  const highest = newest.reduce((most, count) => (count.total > most.total ? count : most));

  return {
    latest,
    change: previous ? { from: previous, by: latest.total - previous.total } : null,
    average: { total: Math.round(sum / recent.length), nights: recent.length },
    highest,
  };
}

/** How the latest night compares with the one before it, in words. */
export function changeText(change: HeadcountSummary["change"], today: IsoDate): string {
  if (!change) return "The first night counted";
  const night = formatWeekdayDate(change.from.night, today);
  if (change.by === 0) return `Same as ${night}`;
  return `${change.by > 0 ? "Up" : "Down"} ${Math.abs(change.by)} from ${night}`;
}

/** The newest night's count, for Home. */
export function latestText(counts: readonly Headcount[], today: IsoDate): string {
  const latest = summarize(counts)?.latest;
  return latest ? `${latest.total} on ${formatWeekdayDate(latest.night, today)}` : "No counts yet";
}

/** Under the form's night, when that night already has a count, since a night has only one. */
export function countedHint(night: string, counts: readonly Headcount[], today: IsoDate): string | null {
  const counted = counts.find((count) => count.night === night);
  if (!counted) return null;
  return `${formatWeekdayDate(night, today)} already has ${counted.total}. To change it, tap it in the list below.`;
}

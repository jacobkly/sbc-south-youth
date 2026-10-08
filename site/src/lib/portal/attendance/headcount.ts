import { addDays, formatWeekdayDate, isIsoDate, weekdayOf, type IsoDate } from "@/lib/dates";

/**
 * The decisions behind each week's headcount at youth, kept apart from the
 * database so each case can be tested. RLS, the check constraint, and the
 * guard_headcount trigger still check everything again, including that a
 * night has only one count.
 */

/** The database's limit on one night's count. */
export const MAX_TOTAL = 1000;

/** The database's limit on a night's note. */
export const MAX_NOTE = 200;

/**
 * One night's count, everyone there, leaders included. A combined event is
 * a night another group joined, which the average and the most leave out.
 */
export type Headcount = { id: string; night: IsoDate; total: number; note: string | null; combined: boolean };

/** The form's fields, as it holds them. */
export type HeadcountValues = { night: string; total: string; note: string; combined: boolean };

export type HeadcountErrors = Partial<Record<"night" | "total" | "note", string>>;

/** A checked count, as the columns the Attendance role can write. */
export type HeadcountFields = Pick<Headcount, "night" | "total" | "note" | "combined">;

export type HeadcountCheck = { ok: true; headcount: HeadcountFields } | { ok: false; errors: HeadcountErrors };

const MESSAGES = {
  night: "Pick the night.",
  future: "Pick a night that's already happened.",
  total: "Enter how many came.",
  whole: "Enter a whole number, like 42.",
  zero: "Enter at least 1.",
  tooMany: `That's more than ${MAX_TOTAL.toLocaleString("en-US")}. Check the number.`,
  note: (length: number) => `Keep the note to ${MAX_NOTE} characters. This one has ${length}.`,
};

const FRIDAY = 5;

/** How many Fridays back the form looks for one that still needs its count. */
const LOOK_BACK = 8;

/** How many of the latest nights the average covers. */
const AVERAGE_NIGHTS = 8;

function text(source: Record<string, unknown>, key: "night" | "total" | "note"): string {
  const value = source[key];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The night, count, note, and mark to save, or what's wrong with each. Today
 * is the latest night allowed. A blank note is saved as none.
 */
export function checkHeadcount(values: unknown, today: IsoDate): HeadcountCheck {
  const source = values && typeof values === "object" ? (values as Record<string, unknown>) : {};
  const night = text(source, "night");
  const total = text(source, "total").replace(/,/g, "");
  const note = text(source, "note");
  const errors: HeadcountErrors = {};

  if (!isIsoDate(night)) errors.night = MESSAGES.night;
  else if (night > today) errors.night = MESSAGES.future;

  if (!total) errors.total = MESSAGES.total;
  else if (!/^\d+$/.test(total)) errors.total = MESSAGES.whole;
  else if (Number(total) < 1) errors.total = MESSAGES.zero;
  else if (Number(total) > MAX_TOTAL) errors.total = MESSAGES.tooMany;

  if (note.length > MAX_NOTE) errors.note = MESSAGES.note(note.length);

  if (errors.night || errors.total || errors.note) return { ok: false, errors };
  return {
    ok: true,
    headcount: { night, total: Number(total), note: note || null, combined: source.combined === true },
  };
}

export type SavePlan =
  | { kind: "invalid"; errors: HeadcountErrors }
  | { kind: "same" }
  | { kind: "write"; row: HeadcountFields };

function sameCount(a: HeadcountFields, b: HeadcountFields): boolean {
  return a.night === b.night && a.total === b.total && a.note === b.note && a.combined === b.combined;
}

/** What saving the form writes: a new night when there's no existing count, or a fix to it. */
export function planSave(values: unknown, existing: Headcount | null, today: IsoDate): SavePlan {
  const check = checkHeadcount(values, today);
  if (!check.ok) return { kind: "invalid", errors: check.errors };
  const row = check.headcount;
  if (existing && sameCount(existing, row)) return { kind: "same" };
  return { kind: "write", row };
}

/** What saving did, in a sentence. `existing` is the count before a fix, or null for a new night. */
export function savedMessage(row: HeadcountFields, existing: HeadcountFields | null, today: IsoDate): string {
  const night = formatWeekdayDate(row.night, today);
  if (!existing) return `Saved ${row.total} for ${night}${row.combined ? ", a combined event" : ""}.`;
  if (existing.night === row.night && existing.total === row.total) return `Saved ${night}.`;
  return `${night} is now ${row.total}.`;
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
  /**
   * How the latest night compares with the regular night before it. Null for
   * the first regular night, and for a combined event, which isn't compared.
   */
  change: { from: Headcount; by: number } | null;
  /** The average of the latest regular nights, up to eight, to the nearest person. Null if all were combined. */
  average: { total: number; nights: number } | null;
  /** The most on a regular night, the latest if several tie. Null if every night was combined. */
  highest: Headcount | null;
  /** How many combined events the average and the most leave out. */
  combined: number;
};

/** The numbers at the top of the Attendance screen, or null before the first count. */
export function summarize(counts: readonly Headcount[]): HeadcountSummary | null {
  const newest = [...counts].sort((a, b) => (a.night < b.night ? 1 : a.night > b.night ? -1 : 0));
  const latest = newest[0];
  if (!latest) return null;

  // A combined event's crowd isn't a normal week's, so only regular nights count toward these.
  const regular = newest.filter((count) => !count.combined);
  const recent = regular.slice(0, AVERAGE_NIGHTS);
  const sum = recent.reduce((total, count) => total + count.total, 0);
  const highest = regular.reduce<Headcount | null>(
    (most, count) => (!most || count.total > most.total ? count : most),
    null,
  );
  const previous = latest.combined ? undefined : regular[1];

  return {
    latest,
    change: previous ? { from: previous, by: latest.total - previous.total } : null,
    average: recent.length > 0 ? { total: Math.round(sum / recent.length), nights: recent.length } : null,
    highest,
    combined: newest.length - regular.length,
  };
}

/** How the latest night compares with the regular night before it, in words. */
export function changeText({ latest, change, combined }: HeadcountSummary, today: IsoDate): string {
  if (latest.combined) return "A combined event";
  // Every night before this one was combined, if there are any.
  if (!change) return combined > 0 ? "No regular night before it" : "The first night counted";
  const night = formatWeekdayDate(change.from.night, today);
  if (change.by === 0) return `Same as ${night}`;
  return `${change.by > 0 ? "Up" : "Down"} ${Math.abs(change.by)} from ${night}`;
}

/** Under the numbers, when the average and the most leave out combined events. */
export function leftOutText(combined: number): string | null {
  if (combined === 0) return null;
  return `Average and Most leave out ${combined} combined ${combined === 1 ? "event" : "events"}.`;
}

/** The newest night's count, for Home. */
export function latestText(counts: readonly Headcount[], today: IsoDate): string {
  const latest = summarize(counts)?.latest;
  if (!latest) return "No counts yet";
  return `${latest.total} on ${formatWeekdayDate(latest.night, today)}${latest.combined ? ", a combined event" : ""}`;
}

/** Under the form's night, when that night already has a count, since a night has only one. */
export function countedHint(night: string, counts: readonly Headcount[], today: IsoDate): string | null {
  const counted = counts.find((count) => count.night === night);
  if (!counted) return null;
  return `${formatWeekdayDate(night, today)} already has ${counted.total}. To change it, tap it in the list below.`;
}

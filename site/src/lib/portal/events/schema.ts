import { z } from "zod";
import { addDays, daysBetween, isIsoDate, laInstant, laMidnight, todayInLA } from "@/lib/dates";

/** The database's limits on an event. */
export const EVENT_LIMITS = {
  title: 80,
  summary: 160,
  body: 4000,
  locationName: 100,
  address: 200,
  costNote: 60,
} as const;

/** The longest an event can run, so a typo in the end can't fill a month of calendars. */
export const MAX_DAYS = 31;

/** The editor's fields, as the form holds them. */
export type EventValues = {
  title: string;
  /** One line for link previews. Blank for none. */
  summary: string;
  /** Plain text. A blank line starts a new paragraph. */
  body: string;
  allDay: boolean;
  /** "YYYY-MM-DD", a date picker's value. For an all-day event, its first day. */
  startDate: string;
  /** "HH:MM" on the Los Angeles clock, a time picker's value. Not used for an all-day event. */
  startTime: string;
  /** For an all-day event, its last day. */
  endDate: string;
  endTime: string;
  locationName: string;
  /** Blank when it's at the church. */
  address: string;
  costNote: string;
  featured: boolean;
};

/** A checked event, as the content columns a site editor can write. */
export type EventFields = {
  title: string;
  summary: string | null;
  body: string | null;
  all_day: boolean;
  starts_at: string;
  ends_at: string;
  location_name: string | null;
  address: string | null;
  cost_note: string | null;
  featured: boolean;
};

export type EventErrors = Partial<
  Record<
    | "title"
    | "summary"
    | "body"
    | "startDate"
    | "startTime"
    | "endDate"
    | "endTime"
    | "locationName"
    | "address"
    | "costNote",
    string
  >
>;

export type EventCheck = { ok: true; event: EventFields } | { ok: false; errors: EventErrors };

const fewer = (what: string, limit: number) => `Keep ${what} to ${limit.toLocaleString("en-US")} characters or fewer.`;

const MESSAGES = {
  title: "Give it a title.",
  startDate: "Pick the day it starts.",
  startTime: "Pick the time it starts.",
  endDate: "Pick the day it ends.",
  endTime: "Pick the time it ends.",
  firstDay: "Pick the first day.",
  lastDay: "Pick the last day.",
  endBeforeStart: "Pick an end after the start.",
  lastBeforeFirst: "Pick a last day on or after the first day.",
  over: "That's already over. Pick a later end.",
  tooLong: `An event can run ${MAX_DAYS} days at most. Pick an earlier end.`,
};

const text = z.preprocess((value) => (typeof value === "string" ? value : ""), z.string());

/** A one-line field: runs of spaces and line breaks become one space. */
const line = (what: string, limit: number) =>
  text.transform((value) => value.replace(/\s+/g, " ").trim()).pipe(z.string().max(limit, fewer(what, limit)));

const eventSchema = z.object({
  title: line("the title", EVENT_LIMITS.title).pipe(z.string().min(1, MESSAGES.title)),
  summary: line("the short description", EVENT_LIMITS.summary),
  body: text
    .transform((value) => value.replace(/\r\n?/g, "\n").trim())
    .pipe(z.string().max(EVENT_LIMITS.body, fewer("it", EVENT_LIMITS.body))),
  locationName: line("the place", EVENT_LIMITS.locationName),
  address: line("the address", EVENT_LIMITS.address),
  costNote: line("the cost", EVENT_LIMITS.costNote),
  featured: z.preprocess((value) => value === true, z.boolean()),
});

const TIME = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?$/;

/** A date picker's value, or null when it isn't a real date. */
function readDate(value: unknown): string | null {
  return typeof value === "string" && isIsoDate(value.trim()) ? value.trim() : null;
}

/** A time picker's value as "HH:MM", or null. Some pickers add seconds. */
function readTime(value: unknown): string | null {
  return typeof value === "string" && TIME.test(value.trim()) ? value.trim().slice(0, 5) : null;
}

/**
 * When the event runs, or what's wrong with it. A timed event starts and
 * ends at the Los Angeles times picked. An all-day one runs from midnight
 * on its first day to midnight after its last, the way calendars show it.
 */
export function checkWhen(
  fields: Record<string, unknown>,
  now: Date,
): { starts_at: string; ends_at: string } | { errors: EventErrors } {
  const allDay = fields.allDay === true;
  const errors: EventErrors = {};
  const startDate = readDate(fields.startDate);
  const endDate = readDate(fields.endDate);
  const startTime = allDay ? "00:00" : readTime(fields.startTime);
  const endTime = allDay ? "00:00" : readTime(fields.endTime);
  if (!startDate) errors.startDate = allDay ? MESSAGES.firstDay : MESSAGES.startDate;
  if (!startTime) errors.startTime = MESSAGES.startTime;
  if (!endDate) errors.endDate = allDay ? MESSAGES.lastDay : MESSAGES.endDate;
  if (!endTime) errors.endTime = MESSAGES.endTime;
  if (!startDate || !startTime || !endDate || !endTime) return { errors };

  const start = allDay ? laMidnight(startDate) : laInstant(startDate, startTime);
  const end = allDay ? laMidnight(addDays(endDate, 1)) : laInstant(endDate, endTime);
  // Counted on the calendar, so a daylight saving change doesn't add or take an hour.
  const days = daysBetween(startDate, endDate) + (allDay ? 1 : 0);
  // The time is the field that's off when the dates match, and the date otherwise.
  const field = !allDay && endDate === startDate ? "endTime" : "endDate";

  if (end <= start) errors[field] = allDay ? MESSAGES.lastBeforeFirst : MESSAGES.endBeforeStart;
  else if (end <= now) errors[!allDay && endDate === todayInLA(now) ? "endTime" : "endDate"] = MESSAGES.over;
  else if (days > MAX_DAYS || (days === MAX_DAYS && !allDay && endTime > startTime)) errors.endDate = MESSAGES.tooLong;
  if (Object.keys(errors).length > 0) return { errors };
  return { starts_at: start.toISOString(), ends_at: end.toISOString() };
}

/**
 * Checks the event editor. Every problem comes back at once, keyed by
 * field, in words the form can show as they are. Blank details are left
 * out, so the site shows nothing for them.
 */
export function checkEvent(input: unknown, { now }: { now: Date }): EventCheck {
  const fields = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const errors: EventErrors = {};

  // Field by field, so the dates are still checked when another field has a problem.
  const values: Partial<z.output<typeof eventSchema>> = {};
  for (const key of Object.keys(eventSchema.shape) as (keyof typeof eventSchema.shape)[]) {
    const result = eventSchema.shape[key].safeParse(fields[key]);
    if (result.success) Object.assign(values, { [key]: result.data });
    else errors[key as keyof EventErrors] = result.error.issues[0]?.message;
  }

  const when = checkWhen(fields, now);
  if ("errors" in when) Object.assign(errors, when.errors);

  const { title, summary, body, locationName, address, costNote, featured } = values;
  if (
    Object.keys(errors).length > 0 ||
    "errors" in when ||
    title === undefined ||
    summary === undefined ||
    body === undefined ||
    locationName === undefined ||
    address === undefined ||
    costNote === undefined
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    event: {
      title,
      summary: summary || null,
      body: body || null,
      all_day: fields.allDay === true,
      starts_at: when.starts_at,
      ends_at: when.ends_at,
      location_name: locationName || null,
      address: address || null,
      cost_note: costNote || null,
      featured: featured ?? false,
    },
  };
}

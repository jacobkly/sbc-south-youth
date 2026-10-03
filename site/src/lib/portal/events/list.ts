import type { Tables } from "@/lib/database.types";
import { addDays, formatWeekdayDate, laDateOf, laTimeOf, type IsoDate } from "@/lib/dates";
import { formatClock, formatClockRange } from "@/lib/schedule";

export type EventRow = Pick<
  Tables<{ schema: "site" }, "events">,
  | "id"
  | "slug"
  | "title"
  | "summary"
  | "body"
  | "starts_at"
  | "ends_at"
  | "all_day"
  | "location_name"
  | "address"
  | "cost_note"
  | "featured"
  | "status"
  | "cancel_reason"
  | "updated_at"
>;

/**
 * Where an event stands. A draft is only in the portal. Once it's
 * published it's on the site and in calendars until it ends, cancelled
 * or not.
 */
export type EventState = "draft" | "upcoming" | "happening" | "cancelled" | "past";

export const STATE_LABELS: Record<EventState, string> = {
  draft: "Draft",
  upcoming: "Coming up",
  happening: "Happening now",
  cancelled: "Cancelled",
  past: "Past",
};

export function eventState(event: Pick<EventRow, "status" | "starts_at" | "ends_at">, now: Date): EventState {
  if (event.status === "draft") return "draft";
  const time = now.getTime();
  if (Date.parse(event.ends_at) <= time) return "past";
  if (event.status === "cancelled") return "cancelled";
  return Date.parse(event.starts_at) <= time ? "happening" : "upcoming";
}

const byTime = (key: "starts_at" | "ends_at", direction: 1 | -1) => (a: EventRow, b: EventRow) =>
  direction * (Date.parse(a[key]) - Date.parse(b[key])) || a.id.localeCompare(b.id);

/**
 * Events by where they stand. Coming ones, with the ones happening now and
 * the ones called off, go soonest first, the way the site lists them.
 * Drafts go by when they'd start, and past ones by most recently ended.
 */
export function groupEvents(events: EventRow[], now: Date): Record<"coming" | "draft" | "past", EventRow[]> {
  const groups: Record<"coming" | "draft" | "past", EventRow[]> = { coming: [], draft: [], past: [] };
  for (const event of events) {
    const state = eventState(event, now);
    groups[state === "draft" || state === "past" ? state : "coming"].push(event);
  }
  groups.coming.sort(byTime("starts_at", 1));
  groups.draft.sort(byTime("starts_at", 1));
  groups.past.sort(byTime("ends_at", -1));
  return groups;
}

/**
 * When an event happens, short enough for a list: "Sat, Nov 14 · 7–9 PM",
 * "Sat, Nov 14 · All day", or both ends of one that runs over days.
 */
export function whenLabel(event: Pick<EventRow, "starts_at" | "ends_at" | "all_day">, today: IsoDate): string {
  const first = laDateOf(event.starts_at);
  // An all-day event ends at midnight after its last day.
  const last = event.all_day ? addDays(laDateOf(event.ends_at), -1) : laDateOf(event.ends_at);
  const start = laTimeOf(event.starts_at);
  const end = laTimeOf(event.ends_at);
  const day = (date: IsoDate) => formatWeekdayDate(date, today);

  if (last <= first) return `${day(first)} · ${event.all_day ? "All day" : formatClockRange(start, end)}`;
  if (event.all_day) return `${day(first)} – ${day(last)}`;
  return `${day(first)}, ${formatClock(start)} – ${day(last)}, ${formatClock(end)}`;
}

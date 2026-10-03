import { addDays, laDateOf, laTimeOf } from "@/lib/dates";
import { eventState, type EventRow, type EventState } from "./list";
import { checkEvent, type EventErrors, type EventFields, type EventValues } from "./schema";

/**
 * The decisions behind each event action, kept apart from the database so
 * each case can be tested. RLS, the column grants, and the triggers still
 * check everything again.
 */

/** Publish puts it on the site and in calendars. Draft keeps it in the portal. */
export type SaveIntent = "publish" | "draft";

/** The event as it is now, read fresh before any change. */
export type ExistingEvent = Pick<EventRow, "status" | "starts_at" | "ends_at">;

type Refuse = { kind: "refuse"; message: string };

export type CancelPlan =
  | Refuse
  | { kind: "invalid"; message: string }
  | { kind: "write"; row: { status: "cancelled"; cancel_reason: string | null } };

export type SavePlan =
  | { kind: "invalid"; errors: EventErrors }
  | Refuse
  | {
      kind: "write";
      row: EventFields & { status: "draft" | "published" };
      /** A draft's slug follows its title. Once it's published, its link stays put. */
      newSlug: boolean;
      state: EventState;
    };

/** The longest reason the database takes for calling an event off. */
export const REASON_MAX = 200;

const OVER = "It's already over.";

/**
 * What saving the editor writes. A published event stays published, since
 * it's already in people's calendars; cancelling is how it comes off. A
 * cancelled one waits until it's put back on, and one that's over stays
 * as it was.
 */
export function planSave(values: unknown, intent: SaveIntent, existing: ExistingEvent | null, now: Date): SavePlan {
  const state = existing && eventState(existing, now);
  if (state === "past") {
    return { kind: "refuse", message: "It's over, so it stays as it was. Make a new one like it instead." };
  }
  if (state === "cancelled") return { kind: "refuse", message: "It's cancelled. Put it back on to change it." };
  if ((state === "upcoming" || state === "happening") && intent === "draft") {
    return { kind: "refuse", message: "It's on the site and in calendars. Save your changes, or cancel it." };
  }

  const check = checkEvent(values, { now });
  if (!check.ok) return { kind: "invalid", errors: check.errors };

  const published = existing?.status === "published" || intent === "publish";
  const row = { ...check.event, status: published ? ("published" as const) : ("draft" as const) };
  return { kind: "write", row, newSlug: !existing || existing.status === "draft", state: eventState(row, now) };
}

/**
 * Calling off an event that went out. It stays on the site with a banner,
 * and calendars show it cancelled, so the reason is what people read.
 */
export function planCancel(existing: ExistingEvent, reason: unknown, now: Date): CancelPlan {
  switch (eventState(existing, now)) {
    case "draft":
      return { kind: "refuse", message: "It's a draft, so nobody has seen it. Delete it instead." };
    case "cancelled":
      return { kind: "refuse", message: "It's already cancelled." };
    case "past":
      return { kind: "refuse", message: OVER };
  }
  const text = typeof reason === "string" ? reason.replace(/\s+/g, " ").trim() : "";
  if (text.length > REASON_MAX) {
    return { kind: "invalid", message: `Keep the reason to ${REASON_MAX} characters or fewer.` };
  }
  return { kind: "write", row: { status: "cancelled", cancel_reason: text || null } };
}

/** Puts a cancelled event back on, for one called off by mistake or back on after all. */
export function planRestore(
  existing: ExistingEvent,
  now: Date,
): Refuse | { kind: "write"; row: { status: "published"; cancel_reason: null } } {
  switch (eventState(existing, now)) {
    case "cancelled":
      return { kind: "write", row: { status: "published", cancel_reason: null } };
    case "past":
      return { kind: "refuse", message: OVER };
    default:
      return { kind: "refuse", message: "It isn't cancelled." };
  }
}

/** Only a draft can be deleted. Anything that went out stays, so calendars and Activity keep its story. */
export function planRemove(existing: ExistingEvent, now: Date): Refuse | { kind: "delete" } {
  switch (eventState(existing, now)) {
    case "draft":
      return { kind: "delete" };
    case "upcoming":
    case "happening":
      return { kind: "refuse", message: "Only a draft can be deleted. Cancel this one instead." };
    default:
      return { kind: "refuse", message: "Only a draft can be deleted." };
  }
}

/**
 * What saving did, in a sentence. `publishing` is true unless the event
 * was already out, so a change to one says Saved, not Published.
 */
export function savedMessage(row: ExistingEvent, now: Date, publishing: boolean): string {
  if (eventState(row, now) === "draft") return "Saved as a draft. Nobody sees it yet.";
  return publishing
    ? "Published. It's on the site now, and subscribed calendars add it the next time they check."
    : "Saved. The site shows the change now, and subscribed calendars catch up the next time they check.";
}

const BLANK: EventValues = {
  title: "",
  summary: "",
  body: "",
  allDay: false,
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
  locationName: "",
  address: "",
  costNote: "",
  featured: false,
};

/** The editor's starting values: blank for a new event, or one as it is, on the Los Angeles clock. */
export function formValues(event: EventRow | null): EventValues {
  if (!event) return BLANK;
  // An all-day event ends at midnight after its last day.
  const endDate = laDateOf(event.ends_at);
  return {
    title: event.title,
    summary: event.summary ?? "",
    body: event.body ?? "",
    allDay: event.all_day,
    startDate: laDateOf(event.starts_at),
    startTime: event.all_day ? "" : laTimeOf(event.starts_at),
    endDate: event.all_day ? addDays(endDate, -1) : endDate,
    endTime: event.all_day ? "" : laTimeOf(event.ends_at),
    locationName: event.location_name ?? "",
    address: event.address ?? "",
    costNote: event.cost_note ?? "",
    featured: event.featured,
  };
}

/** A new event like another: the same words, place, and times, with the dates left to pick. */
export function copyValues(event: EventRow): EventValues {
  return { ...formValues(event), startDate: "", endDate: "" };
}

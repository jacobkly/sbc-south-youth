import { addDays, daysBetween, isIsoDate } from "@/lib/dates";
import type { EventValues } from "./schema";

/** The editor's small decisions, kept out of the form so they can be tested. */

type When = Pick<EventValues, "allDay" | "startDate" | "startTime" | "endDate" | "endTime">;

const DAY = 24 * 60;
/** How long a new event runs until someone picks its end. */
const FIRST_LENGTH = 2 * 60;
const EPOCH = "1970-01-01";

/**
 * Minutes on the Los Angeles wall clock since 1970, or null until both are
 * picked. Counting on the clock, not in UTC, keeps 7–9 PM two hours long
 * across a daylight saving change.
 */
function clockMinutes(date: string, time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(time);
  if (!isIsoDate(date) || !match) return null;
  return daysBetween(EPOCH, date) * DAY + Number(match[1]) * 60 + Number(match[2]);
}

function fromClockMinutes(minutes: number): Pick<When, "endDate" | "endTime"> {
  const time = minutes % DAY;
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    endDate: addDays(EPOCH, Math.floor(minutes / DAY)),
    endTime: `${pad(Math.floor(time / 60))}:${pad(time % 60)}`,
  };
}

/**
 * The end after the start moves, so the event stays as long as it was and
 * nobody has to fix the end by hand. An all-day event keeps its number of
 * days. The first time picked gets two hours, unless an end that still
 * fits was picked already.
 */
export function followStart(
  previous: When,
  start: Pick<When, "startDate" | "startTime">,
): Pick<When, "endDate" | "endTime"> {
  const keep = { endDate: previous.endDate, endTime: previous.endTime };
  if (!isIsoDate(start.startDate)) return keep;

  if (previous.allDay) {
    const known = isIsoDate(previous.startDate) && isIsoDate(previous.endDate);
    const span = known ? Math.max(0, daysBetween(previous.startDate, previous.endDate)) : 0;
    return { endDate: addDays(start.startDate, span), endTime: previous.endTime };
  }

  const from = clockMinutes(start.startDate, start.startTime);
  if (from === null) {
    // Only the day so far. The end moves up to it, so it isn't left before the start.
    const behind = !isIsoDate(previous.endDate) || previous.endDate < start.startDate;
    return behind ? { endDate: start.startDate, endTime: previous.endTime } : keep;
  }

  const was = clockMinutes(previous.startDate, previous.startTime);
  // An end time picked before its day reads as the same day as the start.
  const end = clockMinutes(previous.endDate, previous.endTime) ?? clockMinutes(start.startDate, previous.endTime);
  if (was !== null && end !== null && end > was) return fromClockMinutes(from + (end - was));
  if (end !== null && end > from) return fromClockMinutes(end);
  return fromClockMinutes(from + FIRST_LENGTH);
}

/**
 * Labels for weekly wall-clock times ("HH:MM", 24-hour), which aren't
 * instants, so they skip time zones and Intl on purpose.
 */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Wednesday", or "Wednesdays" for something that happens every week. */
export function weekdayName(weekday: number, { plural = false } = {}): string {
  const name = WEEKDAYS[weekday];
  if (!name) throw new RangeError(`Invalid weekday: ${weekday}`);
  return plural ? `${name}s` : name;
}

function parseClock(time: string): { hour: number; minute: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) throw new RangeError(`Invalid time: ${time}`);
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function clockParts(time: string): { digits: string; period: "AM" | "PM" } {
  const { hour, minute } = parseClock(time);
  const hour12 = hour % 12 || 12;
  return {
    digits: minute === 0 ? String(hour12) : `${hour12}:${String(minute).padStart(2, "0")}`,
    period: hour < 12 ? "AM" : "PM",
  };
}

/** "19:00" -> "7 PM", "19:30" -> "7:30 PM". */
export function formatClock(time: string): string {
  const { digits, period } = clockParts(time);
  return `${digits} ${period}`;
}

/** "19:00" to "21:00" -> "7–9 PM". Both ends keep AM or PM when it changes. */
export function formatClockRange(start: string, end: string): string {
  const from = clockParts(start);
  const to = clockParts(end);
  if (from.period === to.period) return `${from.digits}–${to.digits} ${to.period}`;
  return `${formatClock(start)}–${formatClock(end)}`;
}

import { addDays, laDateOf, laInstant, weekdayOf } from "@/lib/dates";

/**
 * Quick end times for a heads-up. Each ends at 11:59 PM in Los Angeles,
 * counted from the day it starts, so a scheduled post gets the nights
 * after its own start. 11:59 PM reads as that night in the time picker,
 * where midnight would read as the next day.
 */

export type PresetId = "tonight" | "week" | "friday";

export const PRESETS: { id: PresetId; label: string }[] = [
  { id: "tonight", label: "Tonight only" },
  { id: "week", label: "This week" },
  { id: "friday", label: "Until Friday" },
];

const SUNDAY = 0;
const FRIDAY = 5;

/** Days from a weekday to the next `target`, counting today as 0. */
function daysUntil(weekday: number, target: number): number {
  return (target - weekday + 7) % 7;
}

/** When a heads-up that starts at `start` comes down for a preset. */
export function presetEnd(preset: PresetId, start: Date): Date {
  const day = laDateOf(start);
  const weekday = weekdayOf(day);
  const days = {
    tonight: 0,
    // Through Sunday. One started on a Sunday is about the week ahead.
    week: daysUntil(weekday, SUNDAY) || 7,
    friday: daysUntil(weekday, FRIDAY),
  }[preset];
  return laInstant(addDays(day, days), "23:59");
}

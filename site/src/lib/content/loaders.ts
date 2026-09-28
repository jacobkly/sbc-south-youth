import { gatherings } from "@/content/schedule";
import type { WeeklyGathering } from "./types";

/**
 * The one door pages use to get the schedule, events, and announcements.
 * They come from repo files for now. The portal will swap these bodies
 * for database reads without touching any page.
 */

/** The weekly nights, in week order starting Sunday. */
export async function getSchedule(): Promise<WeeklyGathering[]> {
  return [...gatherings].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
}

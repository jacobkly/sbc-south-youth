import type { PostState } from "./list";
import { presetEnd, PRESETS, type PresetId } from "./presets";
import { fromLocalInput, toLocalInput } from "./schema";

/** The composer's small decisions, kept out of the form so they can be tested. */

const HOUR = 60 * 60 * 1000;

/**
 * A start to offer when someone picks Later: the next whole hour. Los
 * Angeles is always a whole number of hours from UTC, so UTC hours line up.
 */
export function nextHour(now: Date): string {
  return toLocalInput(new Date((Math.floor(now.getTime() / HOUR) + 1) * HOUR));
}

/** The quick end that `endsAt` matches for a heads-up starting at `start`, if any. */
export function matchingPreset(start: Date, endsAt: string): PresetId | null {
  return PRESETS.find(({ id }) => toLocalInput(presetEnd(id, start)) === endsAt)?.id ?? null;
}

/**
 * When the heads-up starts, for the composer's summary and quick ends: the
 * start that was picked, a live one's own start, or else now.
 */
export function composerStart(startsAt: string, liveStart: string | null, now: Date): Date {
  if (liveStart) return new Date(liveStart);
  return (startsAt && fromLocalInput(startsAt)) || now;
}

/** The composer's main button, for where the heads-up stands and when it would start. */
export function primaryAction(state: PostState | null, start: Date, now: Date): { label: string; pending: string } {
  const later = start > now;
  if (state === "live" || (state === "scheduled" && later)) return { label: "Save changes", pending: "Saving…" };
  if (state === "scheduled") return { label: "Publish now", pending: "Publishing…" };
  return later ? { label: "Schedule", pending: "Scheduling…" } : { label: "Publish", pending: "Publishing…" };
}

/**
 * Swiping between receipts in the viewer. Distances are CSS pixels, and a
 * drag to the left moves on to the next receipt, like turning a page.
 */

import type { Point } from "./zoom";

/** Which ways there's another receipt to swipe to. */
export type Sides = { previous: boolean; next: boolean };

/** A drag this share of the screen's width moves on, however slow. */
const SWIPE_DISTANCE = 0.2;
/** A flick this fast moves on, in pixels per millisecond. */
const FLICK_SPEED = 0.5;
/** A flick still has to move this far, so a sloppy tap never counts. */
const MIN_FLICK = 20;
/** How far back the release speed is measured. */
const VELOCITY_WINDOW_MS = 100;

/**
 * How far the image moves for a sideways drag. It follows the finger when
 * there's a receipt that way, and stretches like a rubber band when there
 * isn't, so the end of the list is felt instead of hit.
 */
export function swipeOffset(dx: number, width: number, sides: Sides): number {
  const blocked = dx < 0 ? !sides.next : dx > 0 && !sides.previous;
  if (!blocked) return dx;
  return Math.sign(dx) * (1 - 1 / ((Math.abs(dx) * 0.55) / width + 1)) * width;
}

/**
 * Where a drag goes once the finger lifts: 1 on to the next receipt, -1 back
 * to the previous one, or 0 to stay. It takes a long drag or a quick flick
 * that's mostly sideways.
 */
export function swipeStep(drag: Point, velocity: number, width: number, sides: Sides): -1 | 0 | 1 {
  if (Math.abs(drag.y) > Math.abs(drag.x)) return 0;
  const far = Math.abs(drag.x) >= width * SWIPE_DISTANCE;
  const flick =
    Math.abs(drag.x) >= MIN_FLICK && Math.abs(velocity) >= FLICK_SPEED && Math.sign(velocity) === Math.sign(drag.x);
  if (!far && !flick) return 0;
  if (drag.x < 0) return sides.next ? 1 : 0;
  return sides.previous ? -1 : 0;
}

/** A finger's sideways position at a moment, in milliseconds. */
export type Sample = { x: number; t: number };

/**
 * How fast the finger was moving as it lifted, over the last stretch of the
 * drag. Zero if it rested first, so a slow, careful drag doesn't count as a
 * flick.
 */
export function releaseVelocity(samples: readonly Sample[], now: number): number {
  const last = samples.at(-1);
  if (!last || samples.length < 2 || now - last.t > VELOCITY_WINDOW_MS) return 0;
  const recent = samples.find((sample) => last.t - sample.t <= VELOCITY_WINDOW_MS);
  const from = recent && recent !== last ? recent : samples[samples.length - 2];
  return (last.x - from.x) / Math.max(1, last.t - from.t);
}

/** The nearest items before and after `index` that can be viewed. */
export function neighborsOf<T>(
  items: readonly T[],
  index: number,
  canView: (item: T) => boolean,
): { previous: T | null; next: T | null } {
  if (index < 0 || index >= items.length) return { previous: null, next: null };
  return {
    previous: items.slice(0, index).findLast(canView) ?? null,
    next: items.slice(index + 1).find(canView) ?? null,
  };
}

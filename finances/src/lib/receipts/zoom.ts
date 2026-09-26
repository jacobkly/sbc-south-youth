/**
 * Zoom and pan math for the receipt viewer. Points are CSS pixels from the
 * center of the stage (the full-screen area the image sits in).
 */

export type Point = { x: number; y: number };
export type Size = { width: number; height: number };

/** How far the image is zoomed, and how far its center sits from the stage's center. */
export type View = { scale: number; x: number; y: number };

/** Two fingers on the screen: the spot between them and how far apart they are. */
export type Pinch = { mid: Point; distance: number };

/** The whole image, centered. */
export const FIT: View = { scale: 1, x: 0, y: 0 };

/** Enough to read the small print on a phone photo of a receipt. */
export const MAX_SCALE = 6;

/** What a double tap zooms to. */
export const DOUBLE_TAP_SCALE = 2.5;

/** The image's size when it fits the stage, keeping its shape. */
export function fitSize(image: Size, stage: Size): Size {
  const ratio = Math.min(stage.width / image.width, stage.height / image.height);
  return { width: image.width * ratio, height: image.height * ratio };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Keeps the zoom between `min` and `max`, and keeps the image's edges from
 * pulling away from the stage's. A side smaller than the stage is centered.
 */
export function clampView(view: View, fit: Size, stage: Size, min = 1, max = MAX_SCALE): View {
  const scale = clamp(view.scale, min, max);
  const maxX = Math.max(0, (fit.width * scale - stage.width) / 2);
  const maxY = Math.max(0, (fit.height * scale - stage.height) / 2);
  return {
    scale,
    x: maxX === 0 ? 0 : clamp(view.x, -maxX, maxX),
    y: maxY === 0 ? 0 : clamp(view.y, -maxY, maxY),
  };
}

/** Zooms to `scale`, keeping the part of the image under `focus` where it is. */
export function zoomAt(view: View, scale: number, focus: Point): View {
  const ratio = scale / view.scale;
  return {
    scale,
    x: focus.x - (focus.x - view.x) * ratio,
    y: focus.y - (focus.y - view.y) * ratio,
  };
}

/**
 * Zooms by `factor` around `focus`, staying between fit and the most zoom.
 * For the scroll wheel, the +/− buttons, and the keyboard.
 */
export function zoomBy(view: View, factor: number, focus: Point, fit: Size, stage: Size): View {
  return clampView(zoomAt(view, clamp(view.scale * factor, 1, MAX_SCALE), focus), fit, stage);
}

/**
 * Where a pinch has moved the image: the part that started between the
 * fingers stays between them as they spread and move.
 */
export function pinchView(start: View, from: Pinch, to: Pinch): View {
  const moved = { ...start, x: start.x + to.mid.x - from.mid.x, y: start.y + to.mid.y - from.mid.y };
  return zoomAt(moved, start.scale * (to.distance / from.distance), to.mid);
}

/** A double tap zooms in on the spot, or back out to fit when already zoomed. */
export function doubleTapView(view: View, point: Point, fit: Size, stage: Size): View {
  if (view.scale > 1.01) return FIT;
  return zoomBy(view, DOUBLE_TAP_SCALE / view.scale, point, fit, stage);
}

/** Whether a point is on the image rather than the black around it. */
export function onImage(view: View, point: Point, fit: Size): boolean {
  return (
    Math.abs(point.x - view.x) <= (fit.width * view.scale) / 2 &&
    Math.abs(point.y - view.y) <= (fit.height * view.scale) / 2
  );
}

export function pinchOf(a: Point, b: Point): Pinch {
  return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(a.x - b.x, a.y - b.y) };
}

import { describe, expect, it } from "vitest";
import {
  clampView,
  doubleTapView,
  DOUBLE_TAP_SCALE,
  FIT,
  fitSize,
  MAX_SCALE,
  onImage,
  pinchOf,
  pinchView,
  zoomAt,
  zoomBy,
  type Point,
  type View,
} from "./zoom";

// A phone-sized stage and a tall receipt that fits it top to bottom.
const STAGE = { width: 400, height: 800 };
const FIT_SIZE = { width: 300, height: 800 };

/** The spot on the unzoomed image that shows at `point`. */
function imagePointAt(view: View, point: Point): Point {
  return { x: (point.x - view.x) / view.scale, y: (point.y - view.y) / view.scale };
}

describe("fitSize", () => {
  it("fits a tall image by height and a wide one by width", () => {
    expect(fitSize({ width: 1500, height: 4000 }, STAGE)).toEqual(FIT_SIZE);
    expect(fitSize({ width: 2000, height: 1000 }, STAGE)).toEqual({ width: 400, height: 200 });
  });

  it("scales a small image up to fill the stage", () => {
    expect(fitSize({ width: 100, height: 200 }, STAGE)).toEqual({ width: 400, height: 800 });
  });
});

describe("clampView", () => {
  it("keeps the zoom between fit and the most zoom", () => {
    expect(clampView({ scale: 0.5, x: 0, y: 0 }, FIT_SIZE, STAGE).scale).toBe(1);
    expect(clampView({ scale: 20, x: 0, y: 0 }, FIT_SIZE, STAGE).scale).toBe(MAX_SCALE);
  });

  it("centers the image when it's narrower than the stage", () => {
    expect(clampView({ scale: 1, x: 80, y: -40 }, FIT_SIZE, STAGE)).toEqual(FIT);
  });

  it("stops panning at the image's edges", () => {
    // At 2×, the image is 600 × 1600, so it can move 100 across and 400 down.
    expect(clampView({ scale: 2, x: 500, y: -900 }, FIT_SIZE, STAGE)).toEqual({ scale: 2, x: 100, y: -400 });
    expect(clampView({ scale: 2, x: -50, y: 300 }, FIT_SIZE, STAGE)).toEqual({ scale: 2, x: -50, y: 300 });
  });

  it("allows looser limits while pinching", () => {
    expect(clampView({ scale: 0.8, x: 0, y: 0 }, FIT_SIZE, STAGE, 0.75).scale).toBe(0.8);
  });
});

describe("zoomAt", () => {
  it("keeps the spot under the focus in place", () => {
    const view = { scale: 1.5, x: 20, y: -30 };
    const focus = { x: -60, y: 110 };
    const zoomed = zoomAt(view, 4, focus);
    expect(zoomed.scale).toBe(4);
    expect(imagePointAt(zoomed, focus).x).toBeCloseTo(imagePointAt(view, focus).x);
    expect(imagePointAt(zoomed, focus).y).toBeCloseTo(imagePointAt(view, focus).y);
  });
});

describe("zoomBy", () => {
  it("zooms around the center and stays in range", () => {
    expect(zoomBy(FIT, 1.5, { x: 0, y: 0 }, FIT_SIZE, STAGE)).toEqual({ scale: 1.5, x: 0, y: 0 });
    expect(zoomBy(FIT, 0.5, { x: 0, y: 0 }, FIT_SIZE, STAGE)).toEqual(FIT);
    expect(zoomBy({ scale: 5, x: 0, y: 0 }, 2, { x: 0, y: 0 }, FIT_SIZE, STAGE).scale).toBe(MAX_SCALE);
  });

  it("zooming back out to fit recenters the image", () => {
    expect(zoomBy({ scale: 2, x: 100, y: -400 }, 0.25, { x: 50, y: 50 }, FIT_SIZE, STAGE)).toEqual(FIT);
  });
});

describe("pinchView", () => {
  it("zooms by how far the fingers spread, around the spot between them", () => {
    const from = pinchOf({ x: -50, y: 100 }, { x: 50, y: 100 });
    const to = pinchOf({ x: -100, y: 100 }, { x: 100, y: 100 });
    const pinched = pinchView(FIT, from, to);
    expect(pinched.scale).toBe(2);
    expect(imagePointAt(pinched, to.mid)).toEqual(imagePointAt(FIT, from.mid));
  });

  it("moves the image with the fingers", () => {
    const start = { scale: 2, x: 0, y: 0 };
    const from = pinchOf({ x: 0, y: 0 }, { x: 100, y: 0 });
    const to = pinchOf({ x: 30, y: -20 }, { x: 130, y: -20 });
    expect(pinchView(start, from, to)).toEqual({ scale: 2, x: 30, y: -20 });
  });
});

describe("doubleTapView", () => {
  it("zooms in on the tapped spot", () => {
    const point = { x: 60, y: -200 };
    const zoomed = doubleTapView(FIT, point, FIT_SIZE, STAGE);
    expect(zoomed.scale).toBe(DOUBLE_TAP_SCALE);
    expect(imagePointAt(zoomed, point).x).toBeCloseTo(point.x);
    expect(imagePointAt(zoomed, point).y).toBeCloseTo(point.y);
  });

  it("keeps the image's edge at the stage's edge near a corner", () => {
    // At 2.5×, the image is 750 × 2000, so it can move at most 175 across and 600 down.
    expect(doubleTapView(FIT, { x: -150, y: -400 }, FIT_SIZE, STAGE)).toEqual({ scale: 2.5, x: 175, y: 600 });
  });

  it("goes back to fit when already zoomed", () => {
    expect(doubleTapView({ scale: 3, x: 40, y: 10 }, { x: 0, y: 0 }, FIT_SIZE, STAGE)).toBe(FIT);
  });
});

describe("onImage", () => {
  it("tells the image from the black beside it", () => {
    // The fitted image spans x from -150 to 150.
    expect(onImage(FIT, { x: 140, y: 0 }, FIT_SIZE)).toBe(true);
    expect(onImage(FIT, { x: 170, y: 0 }, FIT_SIZE)).toBe(false);
    expect(onImage({ scale: 2, x: 0, y: 0 }, { x: 170, y: 0 }, FIT_SIZE)).toBe(true);
  });
});

describe("pinchOf", () => {
  it("finds the spot between two fingers and how far apart they are", () => {
    expect(pinchOf({ x: 0, y: 0 }, { x: 30, y: 40 })).toEqual({ mid: { x: 15, y: 20 }, distance: 50 });
  });
});

import { describe, expect, it } from "vitest";
import { neighborsOf, releaseVelocity, swipeOffset, swipeStep } from "./swipe";

const BOTH = { previous: true, next: true };
const WIDTH = 375;

describe("swipeOffset", () => {
  it("follows the finger when there's a receipt that way", () => {
    expect(swipeOffset(-120, WIDTH, BOTH)).toBe(-120);
    expect(swipeOffset(90, WIDTH, BOTH)).toBe(90);
  });

  it("resists past the first or last receipt, and never goes a full width", () => {
    const pulled = swipeOffset(-120, WIDTH, { previous: true, next: false });
    expect(pulled).toBeLessThan(0);
    expect(Math.abs(pulled)).toBeLessThan(120 * 0.6);
    expect(Math.abs(swipeOffset(-5000, WIDTH, { previous: true, next: false }))).toBeLessThan(WIDTH);
    expect(swipeOffset(80, WIDTH, { previous: false, next: true })).toBeGreaterThan(0);
    expect(swipeOffset(80, WIDTH, { previous: false, next: true })).toBeLessThan(80);
  });

  it("stays put with no drag", () => {
    expect(swipeOffset(0, WIDTH, { previous: false, next: false })).toBe(0);
  });
});

describe("swipeStep", () => {
  it("moves on to the next receipt after a long drag to the left", () => {
    expect(swipeStep({ x: -100, y: 10 }, 0, WIDTH, BOTH)).toBe(1);
  });

  it("goes back to the previous receipt after a long drag to the right", () => {
    expect(swipeStep({ x: 100, y: -10 }, 0, WIDTH, BOTH)).toBe(-1);
  });

  it("stays after a short, slow drag", () => {
    expect(swipeStep({ x: -40, y: 0 }, -0.1, WIDTH, BOTH)).toBe(0);
  });

  it("moves on after a short, quick flick", () => {
    expect(swipeStep({ x: -40, y: 0 }, -0.8, WIDTH, BOTH)).toBe(1);
    expect(swipeStep({ x: 40, y: 0 }, 0.8, WIDTH, BOTH)).toBe(-1);
  });

  it("ignores a flick that's barely a drag, or that turned back", () => {
    expect(swipeStep({ x: -8, y: 0 }, -2, WIDTH, BOTH)).toBe(0);
    expect(swipeStep({ x: -40, y: 0 }, 0.8, WIDTH, BOTH)).toBe(0);
  });

  it("ignores a drag that's mostly up or down", () => {
    expect(swipeStep({ x: -100, y: 160 }, -0.8, WIDTH, BOTH)).toBe(0);
  });

  it("stays at the first or last receipt", () => {
    expect(swipeStep({ x: -200, y: 0 }, -1, WIDTH, { previous: true, next: false })).toBe(0);
    expect(swipeStep({ x: 200, y: 0 }, 1, WIDTH, { previous: false, next: true })).toBe(0);
  });
});

describe("releaseVelocity", () => {
  it("measures the last stretch of the drag in pixels per millisecond", () => {
    const samples = [
      { x: 0, t: 1000 },
      { x: -10, t: 1060 },
      { x: -40, t: 1100 },
      { x: -80, t: 1150 },
    ];
    // From the sample 100ms before the last one: 70px in 90ms.
    expect(releaseVelocity(samples, 1150)).toBeCloseTo(-70 / 90);
  });

  it("is zero when the finger rested before letting go", () => {
    expect(releaseVelocity([{ x: 0, t: 1000 }, { x: -80, t: 1050 }], 1300)).toBe(0);
  });

  it("is zero with too little to measure", () => {
    expect(releaseVelocity([], 1000)).toBe(0);
    expect(releaseVelocity([{ x: -80, t: 1000 }], 1000)).toBe(0);
  });
});

describe("neighborsOf", () => {
  const RECEIPTS = ["photo 1", "doc.pdf", "photo 2", "photo 3", "last.pdf"];
  const isPhoto = (name: string) => !name.endsWith(".pdf");

  it("finds the nearest viewable receipt on each side, skipping others", () => {
    expect(neighborsOf(RECEIPTS, 2, isPhoto)).toEqual({ previous: "photo 1", next: "photo 3" });
  });

  it("has nothing before the first or after the last", () => {
    expect(neighborsOf(RECEIPTS, 0, isPhoto)).toEqual({ previous: null, next: "photo 2" });
    expect(neighborsOf(RECEIPTS, 3, isPhoto)).toEqual({ previous: "photo 2", next: null });
  });

  it("has nothing for a receipt that isn't in the list", () => {
    expect(neighborsOf(RECEIPTS, -1, isPhoto)).toEqual({ previous: null, next: null });
  });
});

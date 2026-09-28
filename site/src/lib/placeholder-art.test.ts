import { describe, expect, it } from "vitest";
import { PALETTES, placeholderArt } from "./placeholder-art";

describe("placeholderArt", () => {
  it("draws the same art for the same seed", () => {
    expect(placeholderArt("fall-retreat")).toEqual(placeholderArt("fall-retreat"));
  });

  it("varies across seeds", () => {
    const seeds = ["fall-retreat", "weekly-hs", "weekly-college", "pizza-night", "serve-day", "winter-camp", "a", "b"];
    const palettes = new Set(seeds.map((seed) => placeholderArt(seed).palette));
    const images = new Set(seeds.map((seed) => placeholderArt(seed).backgroundImage));
    expect(palettes.size).toBeGreaterThan(2);
    expect(images.size).toBe(seeds.length);
  });

  it("only uses its palette's colors", () => {
    for (const seed of ["one", "two", "three", "four"]) {
      const art = placeholderArt(seed);
      const palette = PALETTES.find((p) => p.name === art.palette)!;
      const colors = art.backgroundImage.match(/#[0-9a-f]{6}/gi) ?? [];
      for (const color of colors) expect([...palette.colors, palette.base]).toContain(color);
    }
  });

  it("keeps the ring inside the frame", () => {
    for (const seed of ["one", "two", "three", "four", "five"]) {
      const { ring } = placeholderArt(seed);
      expect(ring.size).toBeGreaterThanOrEqual(40);
      expect(ring.size).toBeLessThanOrEqual(90);
      expect(ring.x).toBeGreaterThanOrEqual(0);
      expect(ring.x).toBeLessThanOrEqual(100);
      expect(ring.y).toBeGreaterThanOrEqual(0);
      expect(ring.y).toBeLessThanOrEqual(100);
    }
  });
});

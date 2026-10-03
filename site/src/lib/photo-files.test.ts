import { describe, expect, it } from "vitest";
import { PHOTO_LONG_EDGE, fitWithin, photoPath, photoUrl } from "./photo-files";

const ID = "00000000-0000-4000-8000-00000000f001";

describe("photoPath", () => {
  it("puts each size in the photo's folder, named by its type", () => {
    expect(photoPath(ID, "lg", "image/webp")).toBe(`${ID}/lg.webp`);
    expect(photoPath(ID, "sm", "image/webp")).toBe(`${ID}/sm.webp`);
    expect(photoPath(ID, "lg", "image/jpeg")).toBe(`${ID}/lg.jpg`);
    expect(photoPath(ID, "sm", "image/jpeg")).toBe(`${ID}/sm.jpg`);
  });
});

describe("photoUrl", () => {
  it("points at the file in the public bucket", () => {
    expect(photoUrl("https://abc.supabase.co", ID, "sm", "image/jpeg")).toBe(
      `https://abc.supabase.co/storage/v1/object/public/site-photos/${ID}/sm.jpg`,
    );
  });

  it("ignores a trailing slash on the project URL", () => {
    expect(photoUrl("http://127.0.0.1:54321/", ID, "lg", "image/webp")).toBe(
      `http://127.0.0.1:54321/storage/v1/object/public/site-photos/${ID}/lg.webp`,
    );
  });
});

describe("fitWithin", () => {
  it("shrinks a landscape photo to the long edge", () => {
    expect(fitWithin(4032, 3024, PHOTO_LONG_EDGE.lg)).toEqual({ width: 1600, height: 1200 });
  });

  it("shrinks a portrait photo by its height", () => {
    expect(fitWithin(3024, 4032, PHOTO_LONG_EDGE.sm)).toEqual({ width: 480, height: 640 });
  });

  it("never makes a photo bigger", () => {
    expect(fitWithin(1200, 800, PHOTO_LONG_EDGE.lg)).toEqual({ width: 1200, height: 800 });
  });

  it("rounds to whole pixels and keeps at least one", () => {
    expect(fitWithin(1600, 1067, 640)).toEqual({ width: 640, height: 427 });
    expect(fitWithin(10000, 3, 640)).toEqual({ width: 640, height: 1 });
  });

  it("gives the small size the same shape from the large size as from the original", () => {
    const large = fitWithin(4000, 2667, PHOTO_LONG_EDGE.lg);
    expect(fitWithin(large.width, large.height, PHOTO_LONG_EDGE.sm)).toEqual(fitWithin(4000, 2667, PHOTO_LONG_EDGE.sm));
  });

  it("rejects empty sizes", () => {
    expect(() => fitWithin(0, 100, 640)).toThrow(RangeError);
  });
});

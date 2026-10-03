import { describe, expect, it } from "vitest";
import { isPhotoSpot, PHOTO_SPOTS, spotsByPage } from "./photo-spots";

describe("PHOTO_SPOTS", () => {
  it("names each spot the way the database allows", () => {
    for (const { spot } of PHOTO_SPOTS) {
      expect(spot).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(spot.length).toBeLessThanOrEqual(40);
    }
  });

  it("never names two spots the same", () => {
    const spots = PHOTO_SPOTS.map(({ spot }) => spot);
    expect(new Set(spots).size).toBe(spots.length);
  });

  it("labels each spot differently from the others on its page", () => {
    for (const [page, spots] of spotsByPage()) {
      const labels = spots.map(({ label }) => label);
      expect(new Set(labels).size, page).toBe(labels.length);
    }
  });
});

describe("isPhotoSpot", () => {
  it("knows the site's spots", () => {
    expect(isPhotoSpot("home-hero")).toBe(true);
    expect(isPhotoSpot("give-band")).toBe(true);
  });

  it("turns away anything else", () => {
    expect(isPhotoSpot("home")).toBe(false);
    expect(isPhotoSpot("HOME-HERO")).toBe(false);
    expect(isPhotoSpot(null)).toBe(false);
    expect(isPhotoSpot(42)).toBe(false);
  });
});

describe("spotsByPage", () => {
  it("lists every spot once, under its page, in the site's order", () => {
    const pages = spotsByPage();
    expect(pages.map(([page]) => page)).toEqual(["Home", "This Week", "Plan a Visit", "Parents & Safety", "Give"]);
    expect(pages.flatMap(([, spots]) => spots)).toEqual(PHOTO_SPOTS);
  });
});

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isPhotoSpot, PHOTO_SPOTS, spotsByPage } from "./photo-spots";

/** Every `.ts` and `.tsx` file under `dir`, skipping tests. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

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

  it("shows each spot on the public site, so a photo placed there is seen", () => {
    const src = join(process.cwd(), "src");
    const code = [join(src, "app", "(public)"), join(src, "components", "site"), join(src, "content")]
      .flatMap(sourceFiles)
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    // A page reads `spots.entrance` or `spots["home-hero"]`, and content names its spot.
    const shown = (spot: string) =>
      [`spots.${spot}`, `spots["${spot}"]`, `spot: "${spot}"`].some((form) => code.includes(form));
    expect(PHOTO_SPOTS.map(({ spot }) => spot).filter((spot) => !shown(spot))).toEqual([]);
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

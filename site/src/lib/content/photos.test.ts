import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { photoFromRow, placedPhotos, type PhotoRow } from "./photos";

const SUPABASE = "https://example.supabase.co";
const FILES = `${SUPABASE}/storage/v1/object/public/site-photos`;

// The way site.public_photos() sends a row: a spot or an event, never both.
const heroRow: PhotoRow = {
  id: "00000000-0000-4000-8000-0000000f0001",
  spot: "home-hero",
  event_id: null,
  alt: "Hands raised during worship",
  width: 1600,
  height: 1067,
  mime_type: "image/webp",
};

const coverRow: PhotoRow = {
  id: "00000000-0000-4000-8000-0000000f0002",
  spot: null,
  event_id: "00000000-0000-4000-8000-00000000e001",
  alt: "Cabins by a lake",
  width: 1200,
  height: 1600,
  mime_type: "image/jpeg",
};

describe("photoFromRow", () => {
  it("points at the large file and offers both sizes by width", () => {
    expect(photoFromRow(heroRow, SUPABASE)).toEqual({
      src: `${FILES}/${heroRow.id}/lg.webp`,
      srcSet: `${FILES}/${heroRow.id}/sm.webp 640w, ${FILES}/${heroRow.id}/lg.webp 1600w`,
      alt: "Hands raised during worship",
    });
  });

  it("uses the JPEG files of a photo from Safari", () => {
    expect(photoFromRow(coverRow, SUPABASE).src).toBe(`${FILES}/${coverRow.id}/lg.jpg`);
  });

  it("gives a tall photo's small file its own width", () => {
    // 1200 x 1600 shrinks to 480 x 640.
    expect(photoFromRow(coverRow, SUPABASE).srcSet).toBe(
      `${FILES}/${coverRow.id}/sm.jpg 480w, ${FILES}/${coverRow.id}/lg.jpg 1200w`,
    );
  });

  it("works with a project URL that ends in a slash", () => {
    expect(photoFromRow(heroRow, `${SUPABASE}/`).src).toBe(`${FILES}/${heroRow.id}/lg.webp`);
  });
});

describe("placedPhotos", () => {
  it("files each photo under its spot or its event", () => {
    const placed = placedPhotos([heroRow, coverRow], SUPABASE);
    expect(Object.keys(placed.spots)).toEqual(["home-hero"]);
    expect(placed.spots["home-hero"]?.alt).toBe("Hands raised during worship");
    expect(Object.keys(placed.covers)).toEqual([coverRow.event_id]);
    expect(placed.covers[coverRow.event_id!].alt).toBe("Cabins by a lake");
  });

  it("leaves out a spot the site no longer has", () => {
    const placed = placedPhotos([{ ...heroRow, spot: "old-banner" }], SUPABASE);
    expect(placed.spots).toEqual({});
    expect(placed.covers).toEqual({});
  });

  it("has nothing placed when there are no photos", () => {
    expect(placedPhotos([], SUPABASE)).toEqual({ spots: {}, covers: {} });
  });
});

/** Every `.ts` and `.tsx` file under `dir`, skipping tests. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("the site's photos", () => {
  it("never come from a stock photo site", () => {
    const files = [...sourceFiles(join(process.cwd(), "src")), join(process.cwd(), "next.config.ts")];
    const stock = files.filter((path) => /unsplash/i.test(readFileSync(path, "utf8")));
    expect(stock).toEqual([]);
  });
});

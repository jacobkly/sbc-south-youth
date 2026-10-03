/** The database's limit on alt text. */
export const ALT_MAX = 200;

/** The database's limit on each side of a photo, in px. */
const SIDE_MAX = 4000;

/** A random folder name, lowercase like `crypto.randomUUID()`, which is what the storage rules allow. */
const PHOTO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A new photo, once both of its files are up. */
export type NewPhoto = { id: string; alt: string; width: number; height: number };

/** Alt text, trimmed, or what's wrong with it. */
export function checkAlt(alt: unknown): { ok: true; alt: string } | { ok: false; error: string } {
  const trimmed = typeof alt === "string" ? alt.trim() : "";
  if (!trimmed) return { ok: false, error: "Describe what's in the photo." };
  if (trimmed.length > ALT_MAX) return { ok: false, error: `Keep it to ${ALT_MAX} characters or fewer.` };
  return { ok: true, alt: trimmed };
}

function isSide(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= SIDE_MAX;
}

/** Checks a new photo's row as it arrives from the browser. */
export function checkNewPhoto(photo: NewPhoto): { ok: true; row: NewPhoto } | { ok: false; message: string } {
  const alt = checkAlt(photo.alt);
  if (!alt.ok) return { ok: false, message: alt.error };
  if (typeof photo.id !== "string" || !PHOTO_ID.test(photo.id) || !isSide(photo.width) || !isSide(photo.height)) {
    return { ok: false, message: "The photo didn't come through right. Choose it again." };
  }
  return { ok: true, row: { id: photo.id, alt: alt.alt, width: photo.width, height: photo.height } };
}

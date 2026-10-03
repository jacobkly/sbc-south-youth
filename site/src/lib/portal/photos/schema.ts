import { isPhotoSpot, type PhotoSpot } from "@/lib/photo-spots";

/** The database's limit on alt text. */
export const ALT_MAX = 200;

/** The database's limit on each side of a photo, in px. */
const SIDE_MAX = 4000;

/** The database's limit on why a photo came down. */
export const REASON_MAX = 200;

/**
 * An id, lowercase like `crypto.randomUUID()` and Postgres. A photo's is
 * also its folder name, which is what the storage rules allow.
 */
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isId(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}

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
  if (!isId(photo.id) || !isSide(photo.width) || !isSide(photo.height)) {
    return { ok: false, message: "The photo didn't come through right. Choose it again." };
  }
  return { ok: true, row: { id: photo.id, alt: alt.alt, width: photo.width, height: photo.height } };
}

/** Where a photo shows: one spot on the site, one event's cover, or neither, in the library. */
export type Placement = { spot: PhotoSpot | null; eventId: string | null };

/** The placement picker's value for the library. */
export const LIBRARY = "library";

/** A placement as one picker value, like `spot:home-hero` or `event:<id>`. */
export function placementValue({ spot, eventId }: { spot: string | null; eventId: string | null }): string {
  if (spot) return `spot:${spot}`;
  if (eventId) return `event:${eventId}`;
  return LIBRARY;
}

/** A picker value back as a placement, or null when it isn't one. */
export function parsePlacement(value: unknown): Placement | null {
  if (value === LIBRARY) return { spot: null, eventId: null };
  const [, kind, rest] = (typeof value === "string" && /^(spot|event):(.*)$/.exec(value)) || [];
  if (kind === "spot" && isPhotoSpot(rest)) return { spot: rest, eventId: null };
  if (kind === "event" && isId(rest)) return { spot: null, eventId: rest };
  return null;
}

/** A photo's alt text and place, as the photo sheet sends them. */
export type PhotoEdit = { id: string; alt: string; placement: string };

type PhotoChanges = { alt: string; spot: PhotoSpot | null; event_id: string | null };

/** Checks an edit and gives the row's new values. */
export function checkPhotoEdit(
  edit: PhotoEdit,
): { ok: true; id: string; changes: PhotoChanges } | { ok: false; message: string } {
  const alt = checkAlt(edit.alt);
  if (!alt.ok) return { ok: false, message: alt.error };
  const placement = parsePlacement(edit.placement);
  if (!isId(edit.id) || !placement) {
    return { ok: false, message: "That didn't come through right. Reload the page and try again." };
  }
  return { ok: true, id: edit.id, changes: { alt: alt.alt, spot: placement.spot, event_id: placement.eventId } };
}

/** Why a photo is coming down, trimmed, or what's wrong with it. */
export function checkReason(reason: unknown): { ok: true; reason: string } | { ok: false; error: string } {
  const trimmed = typeof reason === "string" ? reason.trim() : "";
  if (!trimmed) return { ok: false, error: "Say why it's coming down." };
  if (trimmed.length > REASON_MAX) return { ok: false, error: `Keep it to ${REASON_MAX} characters or fewer.` };
  return { ok: true, reason: trimmed };
}

/**
 * How taking a photo down went. With `files_left`, it's off the site, but
 * its files are still stored and need deleting again.
 */
export type RemovalResult = { status: "done" | "files_left" | "failed"; message: string };

/** Taking a photo down, linked to the takedown request that asked for it if there was one. */
export type PhotoRemoval = { id: string; reason: string; messageId: string | null };

export function checkRemoval(
  removal: PhotoRemoval,
): { ok: true; removal: PhotoRemoval } | { ok: false; message: string } {
  const reason = checkReason(removal.reason);
  if (!reason.ok) return { ok: false, message: reason.error };
  if (!isId(removal.id) || (removal.messageId !== null && !isId(removal.messageId))) {
    return { ok: false, message: "That didn't come through right. Reload the page and try again." };
  }
  return { ok: true, removal: { id: removal.id, reason: reason.reason, messageId: removal.messageId } };
}

/** Checks a photo id from the browser. */
export function checkPhotoId(id: unknown): id is string {
  return isId(id);
}

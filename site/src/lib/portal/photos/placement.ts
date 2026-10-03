import { isPhotoSpot, spotInfo } from "@/lib/photo-spots";
import { parsePlacement, placementValue } from "./schema";

/**
 * How the Photos screen words where a photo shows. A photo is in one spot,
 * on one event as its cover, or only in the library.
 */

type Placed = { id: string; spot: string | null; eventId: string | null };

export type PlacedEvent = { id: string; title: string; status: "draft" | "published" | "cancelled" };

/** A few words for the photo's badge in the library, or null when it's only in the library. */
export function placementBadge(photo: Placed, events: ReadonlyMap<string, PlacedEvent>): string | null {
  // A spot or event the site no longer has still holds the photo, so it says so.
  if (photo.spot) return isPhotoSpot(photo.spot) ? spotInfo(photo.spot).short : "Old spot";
  if (photo.eventId) {
    const event = events.get(photo.eventId);
    return event ? `Cover: ${event.title}` : "Cover";
  }
  return null;
}

/** A picker value's place in full, like "Home: Top of the page". */
export function placementLabel(value: string, events: ReadonlyMap<string, PlacedEvent>): string {
  const placement = parsePlacement(value);
  if (placement?.spot) {
    const { page, label } = spotInfo(placement.spot);
    return `${page}: ${label}`;
  }
  if (placement?.eventId) return `Cover of ${events.get(placement.eventId)?.title ?? "an event"}`;
  return "Not on the site";
}

/** What saving `value` does, said under the picker. */
export function placementNote(
  value: string,
  photo: Placed,
  photos: readonly Placed[],
  events: ReadonlyMap<string, PlacedEvent>,
): string {
  const placement = parsePlacement(value);
  if (!placement || (!placement.spot && !placement.eventId)) return "Nothing on the site shows it.";
  if (value === placementValue(photo)) return "It's there now.";

  const holder = photos.find(
    (other) =>
      other.id !== photo.id &&
      ((placement.spot && other.spot === placement.spot) || (placement.eventId && other.eventId === placement.eventId)),
  );
  const draft = placement.eventId !== null && events.get(placement.eventId)?.status === "draft";
  const replaces = placement.spot
    ? "The photo there now goes back to the library."
    : "The event's cover now goes back to the library.";
  if (holder) return draft ? `${replaces} It shows once the event is published.` : replaces;
  return draft ? "It shows once the event is published." : "It shows there next time the page loads.";
}

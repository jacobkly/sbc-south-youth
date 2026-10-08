import type { Enums } from "@/lib/database.types";
import { isPhotoSpot, spotInfo, spotsByPage } from "@/lib/photo-spots";
import { parsePlacement, placementValue } from "./schema";

/**
 * How the Photos screen words where a photo shows. A photo is in one spot,
 * on one event as its cover, on one heads-up, or only in the library.
 */

/** The heads-up a photo is on. */
export type PlacedPost = { title: string; status: Enums<{ schema: "site" }, "post_status">; endsAt: string };

type Placed = {
  id: string;
  spot: string | null;
  eventId: string | null;
  postId: string | null;
  post: PlacedPost | null;
};

export type PlacedEvent = { id: string; title: string; status: "draft" | "published" | "cancelled" };

/**
 * Photos a heads-up can take: ones only in the library, and ones on
 * heads-ups that have come down. Its own photo shows on its own, and one on
 * a draft or a heads-up that's up stays where it is.
 */
export function postPhotoChoices<Photo extends Placed>(
  photos: readonly Photo[],
  postId: string | null,
  now: Date,
): Photo[] {
  return photos.filter(({ spot, eventId, postId: on, post }) => {
    if (spot || eventId) return false;
    if (!on) return true;
    return on !== postId && post?.status === "published" && new Date(post.endsAt) <= now;
  });
}

/**
 * For a heads-up's editor: the photo it starts with, and the ones it can
 * take. Its own photo is among them, so it can be picked again after it's
 * removed. One posted again starts with the photo of the heads-up it came
 * from (`from`), when that photo is free to move.
 */
export function postPhotoOptions<Photo extends Placed>(
  photos: readonly Photo[],
  postId: string | null,
  from: string | null,
  now: Date,
): { photo: Photo | null; choices: Photo[] } {
  const choices = postPhotoChoices(photos, postId, now);
  if (postId) {
    const own = photos.find((photo) => photo.postId === postId);
    return own ? { photo: own, choices: [own, ...choices] } : { photo: null, choices };
  }
  return { photo: (from && choices.find((photo) => photo.postId === from)) || null, choices };
}

/**
 * The spots still waiting for a photo, as each page's labels, in the
 * site's order. Pages show generated art there until one is placed.
 */
export function emptySpots(photos: readonly Placed[]): [page: string, labels: string[]][] {
  const filled = new Set(photos.map(({ spot }) => spot));
  return spotsByPage().flatMap(([page, spots]) => {
    const labels = spots.filter(({ spot }) => !filled.has(spot)).map(({ label }) => label);
    return labels.length > 0 ? [[page, labels] as [string, string[]]] : [];
  });
}

/** A few words for the photo's badge in the library, or null when it's only in the library. */
export function placementBadge(photo: Placed, events: ReadonlyMap<string, PlacedEvent>): string | null {
  // A spot or event the site no longer has still holds the photo, so it says so.
  if (photo.spot) return isPhotoSpot(photo.spot) ? spotInfo(photo.spot).short : "Old spot";
  if (photo.eventId) {
    const event = events.get(photo.eventId);
    return event ? `Cover: ${event.title}` : "Cover";
  }
  if (photo.postId) return photo.post ? `Heads-up: ${photo.post.title}` : "Heads-up";
  return null;
}

/**
 * A picker value's place in full, like "Home: Top of the page". A heads-up
 * is only ever the photo's own, so its title comes from the photo.
 */
export function placementLabel(
  value: string,
  events: ReadonlyMap<string, PlacedEvent>,
  photo?: Pick<Placed, "postId" | "post">,
): string {
  const placement = parsePlacement(value);
  if (placement?.spot) {
    const { page, label } = spotInfo(placement.spot);
    return `${page}: ${label}`;
  }
  if (placement?.eventId) return `Cover of ${events.get(placement.eventId)?.title ?? "an event"}`;
  if (placement?.postId) {
    return photo?.postId === placement.postId && photo.post ? `Heads-up: ${photo.post.title}` : "A heads-up";
  }
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
  if (!placement || (!placement.spot && !placement.eventId && !placement.postId)) return "Nothing on the site shows it.";
  if (placement.postId) return "It shows with the heads-up while it's up.";
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

import type { Database } from "@/lib/database.types";
import { fitWithin, PHOTO_LONG_EDGE, photoUrl, type PhotoType } from "@/lib/photo-files";
import { isPhotoSpot, type PhotoSpot } from "@/lib/photo-spots";
import type { Photo } from "./types";

/**
 * Rows from `site.public_photos()`, turned into the photos pages show.
 * Nothing here talks to the database, so it's tested on its own.
 */

type Returns = Database["site"]["Functions"]["public_photos"]["Returns"][number];

/** A placed photo. It holds a spot or an event's cover, so the other is null. */
export type PhotoRow = Omit<Returns, "spot" | "event_id"> & { spot: string | null; event_id: string | null };

export type PlacedPhotos = {
  /** By spot. A spot without a photo is missing, and its page draws art there instead. */
  spots: Partial<Record<PhotoSpot, Photo>>;
  /** Event covers, by event id. */
  covers: Record<string, Photo>;
};

/** A photo's two files for the browser to pick from. The row's size is the large file's. */
export function photoFromRow(row: PhotoRow, supabaseUrl: string): Photo {
  // The database allows only these two.
  const type = row.mime_type as PhotoType;
  const large = photoUrl(supabaseUrl, row.id, "lg", type);
  const small = photoUrl(supabaseUrl, row.id, "sm", type);
  const smallWidth = fitWithin(row.width, row.height, PHOTO_LONG_EDGE.sm).width;
  return { src: large, srcSet: `${small} ${smallWidth}w, ${large} ${row.width}w`, alt: row.alt };
}

export function placedPhotos(rows: readonly PhotoRow[], supabaseUrl: string): PlacedPhotos {
  const placed: PlacedPhotos = { spots: {}, covers: {} };
  for (const row of rows) {
    // A spot the site's code renamed or dropped shows nowhere until it's placed again.
    if (isPhotoSpot(row.spot)) placed.spots[row.spot] = photoFromRow(row, supabaseUrl);
    else if (row.event_id) placed.covers[row.event_id] = photoFromRow(row, supabaseUrl);
  }
  return placed;
}

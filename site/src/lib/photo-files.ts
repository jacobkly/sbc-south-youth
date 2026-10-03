/**
 * Where site photos' files are. Each photo has two sizes in the public
 * site-photos bucket, in a folder named by its random id: WebP, or JPEG when
 * it came from Safari, which can't make WebP. The portal uploads them and
 * the public pages load them by URL, so both read this.
 */

export const PHOTOS_BUCKET = "site-photos";

export type PhotoSize = "lg" | "sm";

export type PhotoType = "image/webp" | "image/jpeg";

/** Each size's long edge, in px. A smaller photo keeps its own size. */
export const PHOTO_LONG_EDGE: Record<PhotoSize, number> = { lg: 1600, sm: 640 };

/** Where one size of a photo is in the bucket. The database checks this exact format. */
export function photoPath(id: string, size: PhotoSize, type: PhotoType): string {
  return `${id}/${size}.${type === "image/jpeg" ? "jpg" : "webp"}`;
}

/** A size's public URL, given the Supabase project URL. Anyone can load it, signed in or not. */
export function photoUrl(supabaseUrl: string, id: string, size: PhotoSize, type: PhotoType): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${PHOTOS_BUCKET}/${photoPath(id, size, type)}`;
}

/** A photo's size, scaled so its long edge is at most `longEdge`. Never larger than it was. */
export function fitWithin(width: number, height: number, longEdge: number): { width: number; height: number } {
  if (!(width > 0 && height > 0)) throw new RangeError(`Invalid image size ${width}x${height}`);

  const scale = Math.min(1, longEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

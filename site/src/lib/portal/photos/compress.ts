import { fitWithin, PHOTO_LONG_EDGE, type PhotoSize, type PhotoType } from "@/lib/photo-files";
import {
  canEncode,
  decodeImage,
  drawScaled,
  isImage,
  releaseCanvas,
  toBlob,
  UnusableFileError,
} from "@/lib/portal/images/canvas";

/**
 * What each size aims for, in bytes: the large one sharp across a laptop
 * screen, the small one light on a phone's data plan.
 */
export const PHOTO_TARGET_BYTES: Record<PhotoSize, number> = { lg: 300 * 1024, sm: 60 * 1024 };

/** Matches the site-photos bucket's file size limit. */
export const MAX_PHOTO_BYTES = 1024 * 1024;

/** Below this on its long side, a photo looks soft on a laptop. */
export const MIN_LONG_EDGE = 1000;

/**
 * Qualities to try, best first. Only the quality steps down, never the
 * size, so the public pages always know each file's width.
 */
const QUALITIES = [0.8, 0.72, 0.64, 0.56, 0.5];

export type ProcessedPhoto = {
  mimeType: PhotoType;
  /** The large size, in px, which the photo's row keeps. */
  width: number;
  height: number;
  files: Record<PhotoSize, Blob>;
};

/** Encodes at each quality until the file fits `target`, keeping the last try if none does. */
async function encode(canvas: HTMLCanvasElement, mimeType: PhotoType, target: number): Promise<Blob> {
  let encoded: Blob | null = null;
  for (const quality of QUALITIES) {
    encoded = await toBlob(canvas, mimeType, quality);
    if (!encoded || encoded.type !== mimeType) {
      throw new UnusableFileError("This browser couldn't prepare the photo. Try another browser.");
    }
    if (encoded.size <= target) break;
  }
  if (!encoded || encoded.size > MAX_PHOTO_BYTES) {
    throw new UnusableFileError("This photo is too big to use, even after shrinking it. Try another one.");
  }
  return encoded;
}

/**
 * Shrinks a photo to the site's two sizes. Drawing it on a canvas turns it
 * the right way up and leaves its EXIF data, such as GPS location, behind.
 * WebP where the browser can make it, and JPEG where it can't (Safari).
 */
export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  if (!isImage(file)) throw new UnusableFileError("Choose a photo, such as a JPEG, PNG, or HEIC.");

  const image = await decodeImage(file);
  const canvases: HTMLCanvasElement[] = [];
  try {
    if (Math.max(image.width, image.height) < MIN_LONG_EDGE) {
      throw new UnusableFileError(
        "This photo is too small to look sharp on the site. Choose the original, not a screenshot or a saved copy.",
      );
    }

    const mimeType: PhotoType = (await canEncode("image/webp")) ? "image/webp" : "image/jpeg";

    const lg = fitWithin(image.width, image.height, PHOTO_LONG_EDGE.lg);
    const large = drawScaled(image, lg.width, lg.height);
    canvases.push(large);
    const largeFile = await encode(large, mimeType, PHOTO_TARGET_BYTES.lg);

    // From the large size, which is quicker than starting over and has the same shape.
    const sm = fitWithin(lg.width, lg.height, PHOTO_LONG_EDGE.sm);
    const small = drawScaled({ source: large, ...lg, release: () => {} }, sm.width, sm.height);
    canvases.push(small);
    const smallFile = await encode(small, mimeType, PHOTO_TARGET_BYTES.sm);

    return { mimeType, width: lg.width, height: lg.height, files: { lg: largeFile, sm: smallFile } };
  } finally {
    canvases.forEach(releaseCanvas);
    image.release();
  }
}

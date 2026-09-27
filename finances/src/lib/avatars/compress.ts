import {
  canEncode,
  decodeImage,
  drawScaled,
  isImage,
  releaseCanvas,
  toBlob,
  UnusableFileError,
  type ImageFormat,
  type Region,
} from "@/lib/images/canvas";

/**
 * Profile pictures are tiny squares, so even a full-size phone photo ends
 * up around 10–30 KB. 256 px stays sharp at the largest size the app shows
 * them (80 px on a 3x iPhone screen).
 */
const SIZES = [256, 192, 128];
const QUALITIES = [0.8, 0.7, 0.6, 0.5];

/** Largest file size to aim for, in bytes. */
export const AVATAR_TARGET_BYTES = 30 * 1024;

/** Matches the `avatars` bucket's file size limit. */
export const MAX_AVATAR_BYTES = 50 * 1024;

export type ProcessedAvatar = {
  blob: Blob;
  mimeType: ImageFormat;
  /** Width and height in px. */
  size: number;
  quality: number;
};

/** The largest centered square in an image. */
export function squareCrop(width: number, height: number): Region {
  if (!(width > 0 && height > 0)) throw new RangeError(`Invalid image size ${width}x${height}`);

  const side = Math.min(width, height);
  return { x: Math.floor((width - side) / 2), y: Math.floor((height - side) / 2), width: side, height: side };
}

export type AvatarAttempt = { size: number; quality: number };

/**
 * The sizes and qualities to try, best first, until one fits the target
 * file size. Each size runs through its qualities before a smaller size is
 * tried. Pictures are never upscaled.
 */
export function avatarAttempts(width: number, height: number): AvatarAttempt[] {
  const side = Math.min(width, height);
  const sizes: number[] = [];
  for (const size of SIZES) {
    const fitted = Math.min(size, side);
    if (sizes.length === 0 || fitted < sizes[sizes.length - 1]) sizes.push(fitted);
  }
  return sizes.flatMap((size) => QUALITIES.map((quality) => ({ size, quality })));
}

/**
 * Crops a photo to a centered square and shrinks it for upload. Re-encoding
 * also strips EXIF data such as GPS location. Quality, then size, steps
 * down until the file fits `AVATAR_TARGET_BYTES`; if nothing does, the
 * smallest try is kept as long as the bucket takes it.
 */
export async function processAvatar(file: File): Promise<ProcessedAvatar> {
  if (!isImage(file)) throw new UnusableFileError("Choose a photo, such as a JPEG, PNG, or HEIC.");

  const image = await decodeImage(file);
  const crop = squareCrop(image.width, image.height);
  let canvas: HTMLCanvasElement | null = null;
  try {
    const mimeType: ImageFormat = (await canEncode("image/webp")) ? "image/webp" : "image/jpeg";

    let encoded: ({ blob: Blob } & AvatarAttempt) | undefined;
    for (const attempt of avatarAttempts(image.width, image.height)) {
      if (canvas?.width !== attempt.size) {
        if (canvas) releaseCanvas(canvas);
        canvas = drawScaled(image, attempt.size, attempt.size, crop);
      }
      const blob = await toBlob(canvas, mimeType, attempt.quality);
      if (!blob || blob.type !== mimeType) throw new UnusableFileError("This browser couldn't save the picture. Try another browser.");
      encoded = { blob, ...attempt };
      if (blob.size <= AVATAR_TARGET_BYTES) break;
    }

    // avatarAttempts always returns at least one attempt.
    if (!encoded) throw new UnusableFileError("This picture couldn't be processed.");
    if (encoded.blob.size > MAX_AVATAR_BYTES) throw new UnusableFileError("This picture couldn't be made small enough. Try another photo.");

    return { blob: encoded.blob, mimeType, size: encoded.size, quality: encoded.quality };
  } finally {
    if (canvas) releaseCanvas(canvas);
    image.release();
  }
}

import {
  canEncode,
  decodeImage,
  drawScaled,
  isImage,
  releaseCanvas,
  toBlob,
  UnusableFileError,
} from "@/lib/images/canvas";
import { RECEIPT_COMPRESSION, type CompressionSettings, type OutputFormat } from "./compression-config";

/** Matches the `receipts` bucket's file size limit. */
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

export type ReceiptMimeType = OutputFormat | "application/pdf";

export type ProcessedReceipt = {
  blob: Blob;
  mimeType: ReceiptMimeType;
  /** Output size in px, or null for PDFs. */
  width: number | null;
  height: number | null;
  /** Encoder quality used, or null for PDFs. */
  quality: number | null;
  original: { size: number; type: string; width: number | null; height: number | null };
};

/**
 * Output size for an image: scale so the short edge hits the target,
 * shrink further if the long edge would pass the cap, and never upscale.
 */
export function targetSize(
  width: number,
  height: number,
  settings: Pick<CompressionSettings, "shortEdge" | "maxLongEdge">,
): { width: number; height: number } {
  if (!(width > 0 && height > 0)) throw new RangeError(`Invalid image size ${width}x${height}`);

  const short = Math.min(width, height);
  const long = Math.max(width, height);
  const scale = Math.min(1, settings.shortEdge / short, settings.maxLongEdge / long);

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export type CompressionAttempt = { width: number; height: number; quality: number };

/**
 * The sizes and qualities to try, best first, until one fits the target
 * file size. Each size runs through its qualities before a smaller size is
 * tried. Smaller sizes that wouldn't shrink the image are skipped.
 */
export function compressionAttempts(
  width: number,
  height: number,
  settings: CompressionSettings,
  startQuality: number,
): CompressionAttempt[] {
  const qualities = [startQuality, ...settings.lowerQualities.filter((quality) => quality < startQuality)];

  const sizes = [targetSize(width, height, settings)];
  for (const shortEdge of settings.smallerShortEdges) {
    const size = targetSize(width, height, { ...settings, shortEdge });
    const last = sizes[sizes.length - 1];
    if (size.width * size.height < last.width * last.height) sizes.push(size);
  }

  return sizes.flatMap((size) => qualities.map((quality) => ({ ...size, quality })));
}

/** File extension used in storage paths for each receipt type. */
export function extensionFor(mimeType: ReceiptMimeType): "webp" | "jpg" | "pdf" {
  switch (mimeType) {
    case "image/webp":
      return "webp";
    case "image/jpeg":
      return "jpg";
    case "application/pdf":
      return "pdf";
  }
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || (file.type === "" && /\.pdf$/i.test(file.name));
}

/**
 * Prepares a receipt for upload. Images are resized and re-encoded, which
 * also strips EXIF data such as GPS location. Quality, then size, steps
 * down until the file fits `targetBytes`; if nothing fits, the smallest
 * attempt is kept. PDFs pass through unchanged.
 */
export async function processReceipt(
  file: File,
  settings: CompressionSettings = RECEIPT_COMPRESSION,
): Promise<ProcessedReceipt> {
  if (isPdf(file)) {
    if (file.size > MAX_RECEIPT_BYTES) throw new UnusableFileError("PDFs must be 10 MB or smaller.");
    return {
      blob: file,
      mimeType: "application/pdf",
      width: null,
      height: null,
      quality: null,
      original: { size: file.size, type: "application/pdf", width: null, height: null },
    };
  }

  if (!isImage(file)) throw new UnusableFileError("Receipts must be a photo or a PDF.");

  const image = await decodeImage(file);
  let canvas: HTMLCanvasElement | null = null;
  try {
    const mimeType: OutputFormat = (await canEncode(settings.format)) ? settings.format : "image/jpeg";
    const startQuality = mimeType === settings.format ? settings.quality : settings.jpegFallbackQuality;

    let encoded: ({ blob: Blob } & CompressionAttempt) | undefined;
    for (const attempt of compressionAttempts(image.width, image.height, settings, startQuality)) {
      if (canvas?.width !== attempt.width || canvas.height !== attempt.height) {
        if (canvas) releaseCanvas(canvas);
        canvas = drawScaled(image, attempt.width, attempt.height);
      }
      const blob = await toBlob(canvas, mimeType, attempt.quality);
      if (!blob || blob.type !== mimeType) throw new UnusableFileError("This browser couldn't save the image. Try another browser.");
      encoded = { blob, ...attempt };
      if (blob.size <= settings.targetBytes) break;
    }

    // compressionAttempts always returns at least one attempt.
    if (!encoded) throw new UnusableFileError("This image couldn't be processed.");
    if (encoded.blob.size > MAX_RECEIPT_BYTES) throw new UnusableFileError("This image is still over 10 MB after compression.");

    return {
      blob: encoded.blob,
      mimeType,
      width: encoded.width,
      height: encoded.height,
      quality: encoded.quality,
      original: { size: file.size, type: file.type, width: image.width, height: image.height },
    };
  } finally {
    if (canvas) releaseCanvas(canvas);
    image.release();
  }
}

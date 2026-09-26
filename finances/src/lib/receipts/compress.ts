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

/** A problem with the chosen file, with a message safe to show the user. */
export class ReceiptFileError extends Error {
  override name = "ReceiptFileError";
}

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

function isHeic(file: File): boolean {
  return /^image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

function isImage(file: File): boolean {
  return file.type.startsWith("image/") || isHeic(file);
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

/** Decodes an image with its EXIF orientation applied. */
async function decodeImage(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Fall through to <img>, which some browsers decode more formats with.
    }
  }

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new ReceiptFileError(
      isHeic(file)
        ? "This browser can't open HEIC photos. Save the photo as a JPEG first, or upload it from your iPhone."
        : "This image couldn't be opened. Try taking the photo again or choose a JPEG or PNG.",
    );
  }
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  };
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ReceiptFileError("This browser couldn't process the image.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

/**
 * Draws the image at the target size. Large reductions are done in halving
 * steps, which keeps small receipt print sharper than one big jump.
 */
function drawScaled(image: Decoded, width: number, height: number): HTMLCanvasElement {
  let source: CanvasImageSource = image.source;
  let currentWidth = image.width;
  let currentHeight = image.height;

  while (currentWidth / 2 >= width && currentHeight / 2 >= height) {
    const step = createCanvas(Math.round(currentWidth / 2), Math.round(currentHeight / 2));
    context2d(step).drawImage(source, 0, 0, step.width, step.height);
    source = step;
    currentWidth = step.width;
    currentHeight = step.height;
  }

  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);
  // Transparent PNGs would otherwise turn black in JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, type: OutputFormat, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Whether this browser's canvas can really encode `type`. Safari quietly returns PNG for WebP. */
export async function canEncode(type: OutputFormat): Promise<boolean> {
  const blob = await toBlob(createCanvas(1, 1), type, 1);
  return blob?.type === type;
}

/** Frees a canvas's pixels now. Safari can run out of canvas memory waiting for garbage collection. */
function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
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
    if (file.size > MAX_RECEIPT_BYTES) throw new ReceiptFileError("PDFs must be 10 MB or smaller.");
    return {
      blob: file,
      mimeType: "application/pdf",
      width: null,
      height: null,
      quality: null,
      original: { size: file.size, type: "application/pdf", width: null, height: null },
    };
  }

  if (!isImage(file)) throw new ReceiptFileError("Receipts must be a photo or a PDF.");

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
      if (!blob || blob.type !== mimeType) throw new ReceiptFileError("This browser couldn't save the image. Try another browser.");
      encoded = { blob, ...attempt };
      if (blob.size <= settings.targetBytes) break;
    }

    // compressionAttempts always returns at least one attempt.
    if (!encoded) throw new ReceiptFileError("This image couldn't be processed.");
    if (encoded.blob.size > MAX_RECEIPT_BYTES) throw new ReceiptFileError("This image is still over 10 MB after compression.");

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

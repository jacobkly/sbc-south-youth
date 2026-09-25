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

/** Encodes in the preferred format, falling back to JPEG when the browser quietly returns something else. */
async function encode(canvas: HTMLCanvasElement, settings: CompressionSettings): Promise<{ blob: Blob; mimeType: OutputFormat }> {
  const preferred = await toBlob(canvas, settings.format, settings.quality);
  if (preferred && preferred.type === settings.format) return { blob: preferred, mimeType: settings.format };

  const jpeg = await toBlob(canvas, "image/jpeg", settings.jpegFallbackQuality);
  if (jpeg && jpeg.type === "image/jpeg") return { blob: jpeg, mimeType: "image/jpeg" };

  throw new ReceiptFileError("This browser couldn't save the image. Try another browser.");
}

/**
 * Prepares a receipt for upload. Images are resized and re-encoded, which
 * also strips EXIF data such as GPS location. PDFs pass through unchanged.
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
      original: { size: file.size, type: "application/pdf", width: null, height: null },
    };
  }

  if (!isImage(file)) throw new ReceiptFileError("Receipts must be a photo or a PDF.");

  const image = await decodeImage(file);
  try {
    const size = targetSize(image.width, image.height, settings);
    const canvas = drawScaled(image, size.width, size.height);
    const { blob, mimeType } = await encode(canvas, settings);
    if (blob.size > MAX_RECEIPT_BYTES) throw new ReceiptFileError("This image is still over 10 MB after compression.");

    return {
      blob,
      mimeType,
      width: size.width,
      height: size.height,
      original: { size: file.size, type: file.type, width: image.width, height: image.height },
    };
  } finally {
    image.release();
  }
}

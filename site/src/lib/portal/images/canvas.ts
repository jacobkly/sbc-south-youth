/**
 * Browser helpers for shrinking a picked photo: decode it, draw it smaller
 * on a canvas, and encode the result. Receipts and profile pictures both
 * use these.
 */

export type ImageFormat = "image/webp" | "image/jpeg";

/** A problem with the chosen file, with a message safe to show the user. */
export class UnusableFileError extends Error {
  override name = "UnusableFileError";
}

export function isHeic(file: File): boolean {
  return /^image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

export function isImage(file: File): boolean {
  return file.type.startsWith("image/") || isHeic(file);
}

export type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

/** Decodes an image with its EXIF orientation applied. */
export async function decodeImage(file: File): Promise<Decoded> {
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
    throw new UnusableFileError(
      isHeic(file)
        ? "This browser can't open HEIC photos. Save the photo as a JPEG first, or upload it from your iPhone."
        : "This image couldn't be opened. Take the photo again, or choose a JPEG or PNG.",
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
  if (!ctx) throw new UnusableFileError("This browser couldn't open the image. Try another browser.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

/** A part of an image, in px. */
export type Region = { x: number; y: number; width: number; height: number };

/**
 * Draws `region` of the image (all of it by default) at the target size.
 * Large reductions are done in halving steps, which keeps small print and
 * fine detail sharper than one big jump.
 */
export function drawScaled(
  image: Decoded,
  width: number,
  height: number,
  region: Region = { x: 0, y: 0, width: image.width, height: image.height },
): HTMLCanvasElement {
  let source: CanvasImageSource = image.source;
  let from = region;

  while (from.width / 2 >= width && from.height / 2 >= height) {
    const step = createCanvas(Math.round(from.width / 2), Math.round(from.height / 2));
    context2d(step).drawImage(source, from.x, from.y, from.width, from.height, 0, 0, step.width, step.height);
    source = step;
    from = { x: 0, y: 0, width: step.width, height: step.height };
  }

  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);
  // Transparent PNGs would otherwise turn black in JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, from.x, from.y, from.width, from.height, 0, 0, width, height);
  return canvas;
}

export function toBlob(canvas: HTMLCanvasElement, type: ImageFormat, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Whether this browser's canvas can really encode `type`. Safari quietly returns PNG for WebP. */
export async function canEncode(type: ImageFormat): Promise<boolean> {
  const blob = await toBlob(createCanvas(1, 1), type, 1);
  return blob?.type === type;
}

/** Frees a canvas's pixels now. Safari can run out of canvas memory waiting for garbage collection. */
export function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

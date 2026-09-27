/**
 * Receipt compression settings, shared by the real upload path and the
 * /dev/compression-test page. Receipts must stay readable at full zoom
 * while landing under about 300 KB, so the 1 GB storage tier holds a few
 * thousand of them.
 *
 * Photos start at `shortEdge` and `quality`. Anything over `targetBytes`
 * steps down through `lowerQualities`, then `smallerShortEdges`, until it
 * fits. Tiny print holds up better at full size and lower quality than at
 * a smaller size, so size is the last thing to give.
 */

import type { ImageFormat } from "@/lib/images/canvas";

export type OutputFormat = ImageFormat;

export type CompressionSettings = {
  /** Target length of the shorter side, in px. Images are never upscaled. */
  shortEdge: number;
  /** Cap on the longer side, in px, so very long receipts stay a sane size. */
  maxLongEdge: number;
  /** Preferred output format. */
  format: OutputFormat;
  /** Encoder quality for the preferred format, 0–1. */
  quality: number;
  /** Quality used when the browser can't encode the preferred format (Safari may not encode WebP). */
  jpegFallbackQuality: number;
  /** Largest file size to aim for, in bytes. */
  targetBytes: number;
  /** Lower qualities to try, in order, while the file is over `targetBytes`. */
  lowerQualities: number[];
  /** Smaller short edges to try, in order, when no quality gets under `targetBytes`. */
  smallerShortEdges: number[];
};

export const RECEIPT_COMPRESSION: CompressionSettings = {
  shortEdge: 1500,
  maxLongEdge: 4000,
  format: "image/webp",
  quality: 0.7,
  jpegFallbackQuality: 0.7,
  targetBytes: 300 * 1024,
  lowerQualities: [0.6, 0.5],
  smallerShortEdges: [1200, 1000],
};

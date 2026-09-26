/**
 * Receipt compression settings, shared by the real upload path and the
 * /dev/compression-test page. Receipts must stay readable at full zoom
 * while averaging about 500 KB, so the 1 GB storage tier lasts for years.
 *
 * Photos start at `shortEdge` and `quality`. Detailed or noisy photos can
 * come out well over 1 MB that way, so anything over `targetBytes` steps
 * down through `lowerQualities`, then `smallerShortEdges`, until it fits.
 */

export type OutputFormat = "image/webp" | "image/jpeg";

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
  quality: 0.82,
  jpegFallbackQuality: 0.85,
  targetBytes: 500 * 1024,
  lowerQualities: [0.7, 0.6, 0.5],
  smallerShortEdges: [1200, 1000],
};

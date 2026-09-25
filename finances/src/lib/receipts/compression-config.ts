/**
 * Receipt compression settings, shared by the real upload path and the
 * /dev/compression-test page. Receipts must stay readable at full zoom
 * while averaging about 500 KB, so the 1 GB storage tier lasts for years.
 *
 * Starting values until the compression test picks final ones.
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
};

export const RECEIPT_COMPRESSION: CompressionSettings = {
  shortEdge: 1500,
  maxLongEdge: 4000,
  format: "image/webp",
  quality: 0.82,
  jpegFallbackQuality: 0.85,
};

/**
 * The pieces of a link preview image that don't draw anything, so they
 * can be tested without rendering.
 */

import { site } from "@/content/site";

/** The size every link preview uses. */
export const SHARE_SIZE = { width: 1200, height: 630 };

/** A page's preview image description, like "Plan a Visit at SBC South Youth: Your first Friday". */
export function shareAlt({ title, heading }: { title: string; heading: string }): string {
  return `${title} at ${site.name}: ${heading}`;
}

/**
 * The headline size in pixels. Short titles fill the frame; longer ones
 * step down so they fit in three lines.
 */
export function titleSize(title: string): number {
  const length = title.length;
  if (length <= 14) return 136;
  if (length <= 24) return 116;
  if (length <= 36) return 96;
  if (length <= 52) return 80;
  return 64;
}

/** The font file in a Google Fonts stylesheet, if it's one the renderer reads (TTF or OTF, not WOFF2). */
export function fontFileUrl(css: string): string | null {
  return css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1] ?? null;
}

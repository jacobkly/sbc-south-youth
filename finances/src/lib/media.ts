/** PCs: a mouse or trackpad, at any width. Matches the `desktop:` variant in globals.css. */
export const DESKTOP_QUERY = "(hover: hover) and (pointer: fine)";

/** Whether the page is showing the PC controls rather than the phone and tablet ones. */
export function isDesktop(): boolean {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

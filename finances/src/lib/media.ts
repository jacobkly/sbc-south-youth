/** PCs: a wide screen with a mouse or trackpad. Matches the `desktop:` variant in globals.css. */
export const DESKTOP_QUERY = "(min-width: 64rem) and (hover: hover) and (pointer: fine)";

/** Whether the page is showing the PC layout rather than the phone and tablet one. */
export function isDesktop(): boolean {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

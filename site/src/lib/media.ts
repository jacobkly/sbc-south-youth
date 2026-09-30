/** PCs: a mouse or trackpad, at any width. A touchscreen laptop still counts. Same as finances. */
export const DESKTOP_QUERY = "(hover: hover) and (pointer: fine)";

/** Whether focusing a text field is safe, because there's no on-screen keyboard to pop up. */
export function isDesktop(): boolean {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

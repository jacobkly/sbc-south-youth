/**
 * Keeps a cached feed honest in the browser. The server marks up the
 * feed with data attributes, and `refreshFeed` updates them:
 *
 * - `data-item` elements are announcements and agenda items. Once their
 *   `data-until` time (ms) passes, they're hidden.
 * - `data-box` elements (sections, days) hide once they have no item
 *   left.
 * - `data-empty` elements show only when their `data-scope` has no item
 *   left.
 * - `data-date` elements get `data-rel` "today" or "tomorrow", or "now"
 *   once their `data-start` time (ms) passes, like `relativeDay`. A
 *   `data-days` element inside one shows how many days away it is.
 *
 * It runs as an inline script before the first paint, so it can't use
 * imports or anything outside itself.
 */

export const FEED_ID = "feed";

/** Hides what's over, and the boxes and empty states that depend on it. */
export function refreshFeed(root: HTMLElement | null): void {
  if (!root) return;
  const now = Date.now();

  root.querySelectorAll<HTMLElement>("[data-until]").forEach((element) => {
    if (Number(element.dataset.until) <= now) element.hidden = true;
  });

  const hasItem = (container: Element) => container.querySelector("[data-item]:not([hidden])") !== null;
  root.querySelectorAll<HTMLElement>("[data-box]").forEach((box) => {
    box.hidden = !hasItem(box);
  });
  root.querySelectorAll<HTMLElement>("[data-empty]").forEach((empty) => {
    empty.hidden = hasItem(empty.closest("[data-scope]") ?? root);
  });

  const parts: Record<string, string> = {};
  new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(now)
    .forEach((part) => {
      parts[part.type] = part.value;
    });
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const tomorrow = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1))
    .toISOString()
    .slice(0, 10);
  root.querySelectorAll<HTMLElement>("[data-date]").forEach((day) => {
    const date = day.dataset.date;
    const started = day.dataset.start !== undefined && Number(day.dataset.start) <= now;
    day.dataset.rel = started ? "now" : date === today ? "today" : date === tomorrow ? "tomorrow" : "";
    day.querySelectorAll<HTMLElement>("[data-days]").forEach((count) => {
      count.textContent = String((Date.parse(date ?? "") - Date.parse(today)) / 864e5);
    });
  });
}

/** A call to `refreshFeed` as inline script source, for the root by id. */
export function inlineCall(fn: (root: HTMLElement | null) => void): string {
  return `(${fn.toString()})(document.getElementById(${JSON.stringify(FEED_ID)}))`;
}

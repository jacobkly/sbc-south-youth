/**
 * Keeps a cached feed honest in the browser. The server marks up the
 * feed with data attributes, and these functions update them:
 *
 * - `data-for` on the feed root is the audience filter. CSS hides every
 *   `[data-show]` element whose list doesn't include it.
 * - `data-item` elements are announcements and agenda items. Once their
 *   `data-until` time (ms) passes, they're hidden.
 * - `data-box` elements (sections, days) show under the filters that
 *   still have a visible item inside them.
 * - `data-empty` elements show under their one filter when their
 *   `data-scope` has nothing left for it.
 * - `data-date` elements get `data-rel` "today" or "tomorrow", or "now"
 *   once their `data-start` time (ms) passes, like `relativeDay`. A
 *   `data-days` element inside one shows how many days away it is.
 *
 * Each runs as an inline script before the first paint, so they can't
 * use imports or anything outside themselves.
 */

export const FEED_ID = "feed";

/** Sets the filter from `?for=`, before the first paint. */
export function applyUrlAudience(root: HTMLElement | null, filters: string[]): void {
  if (!root) return;
  const value = new URLSearchParams(window.location.search).get("for");
  root.setAttribute("data-for", value && filters.indexOf(value) >= 0 ? value : "all");
}

/** Hides what's over and works out what each filter shows. */
export function refreshFeed(root: HTMLElement | null): void {
  if (!root) return;
  const now = Date.now();

  root.querySelectorAll<HTMLElement>("[data-until]").forEach((element) => {
    if (Number(element.dataset.until) <= now) element.hidden = true;
  });

  const keysIn = (container: Element): string[] => {
    const keys: string[] = [];
    container.querySelectorAll<HTMLElement>("[data-item]:not([hidden])").forEach((item) => {
      (item.dataset.show ?? "").split(" ").forEach((key) => {
        if (key && keys.indexOf(key) < 0) keys.push(key);
      });
    });
    return keys;
  };
  root.querySelectorAll<HTMLElement>("[data-box]").forEach((box) => {
    box.dataset.show = keysIn(box).join(" ");
  });
  root.querySelectorAll<HTMLElement>("[data-empty]").forEach((empty) => {
    const key = empty.dataset.empty ?? "";
    empty.dataset.show = keysIn(empty.closest("[data-scope]") ?? root).indexOf(key) < 0 ? key : "";
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

/** A call to one of these as inline script source, for the root by id. */
export function inlineCall(fn: (root: HTMLElement | null, ...args: never[]) => void, ...args: unknown[]): string {
  const rest = args.map((arg) => `,${JSON.stringify(arg)}`).join("");
  return `(${fn.toString()})(document.getElementById(${JSON.stringify(FEED_ID)})${rest})`;
}

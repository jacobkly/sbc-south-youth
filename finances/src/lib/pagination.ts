/** How many pages a list of `total` items takes. Always at least one. */
export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}

export type PageSlice<T> = {
  /** The page shown, moved into range if it was past either end. */
  page: number;
  items: T[];
  /** The positions of the page's first and last items, counting from 1. */
  first: number;
  last: number;
};

/** One page of a list. */
export function pageSlice<T>(items: readonly T[], page: number, size: number): PageSlice<T> {
  const shown = Math.min(Math.max(1, page), pageCount(items.length, size));
  const start = (shown - 1) * size;
  const slice = items.slice(start, start + size);
  return { page: shown, items: slice, first: slice.length > 0 ? start + 1 : 0, last: start + slice.length };
}

/** The most places a page list takes: the first and last pages, two gaps, and three around the current one. */
const PLACES = 7;

/**
 * The page buttons to show, with "gap" where pages are skipped. The first
 * and last pages always show, along with the pages next to the current one.
 * A long list always takes seven places, so the buttons don't shift.
 */
export function pageItems(current: number, count: number): (number | "gap")[] {
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);
  if (count <= PLACES) return range(1, count);
  if (current <= 4) return [...range(1, 5), "gap", count];
  if (current >= count - 3) return [1, "gap", ...range(count - 4, count)];
  return [1, "gap", current - 1, current, current + 1, "gap", count];
}

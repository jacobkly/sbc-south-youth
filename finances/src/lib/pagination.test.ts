import { describe, expect, it } from "vitest";
import { pageCount, pageItems, pageSlice } from "./pagination";

describe("pageCount", () => {
  it("counts full and partial pages", () => {
    expect(pageCount(15, 15)).toBe(1);
    expect(pageCount(16, 15)).toBe(2);
    expect(pageCount(45, 15)).toBe(3);
  });

  it("is at least one, so an empty list still has a page", () => {
    expect(pageCount(0, 15)).toBe(1);
  });
});

describe("pageSlice", () => {
  const items = Array.from({ length: 42 }, (_, index) => index + 1);

  it("returns the page's items and where they sit in the list", () => {
    expect(pageSlice(items, 2, 15)).toEqual({ page: 2, items: items.slice(15, 30), first: 16, last: 30 });
  });

  it("stops at the end on the last page", () => {
    expect(pageSlice(items, 3, 15)).toEqual({ page: 3, items: items.slice(30), first: 31, last: 42 });
  });

  it("moves a page past the end back to the last page", () => {
    // A link from before some requests were removed can point past the end.
    expect(pageSlice(items, 9, 15).page).toBe(3);
    expect(pageSlice(items, 0, 15).page).toBe(1);
  });
});

describe("pageItems", () => {
  it("lists every page when there are seven or fewer", () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("keeps the first and last pages with a gap near the start", () => {
    expect(pageItems(1, 10)).toEqual([1, 2, 3, 4, 5, "gap", 10]);
    expect(pageItems(4, 10)).toEqual([1, 2, 3, 4, 5, "gap", 10]);
  });

  it("shows the pages around the current one in the middle", () => {
    expect(pageItems(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10]);
    expect(pageItems(6, 10)).toEqual([1, "gap", 5, 6, 7, "gap", 10]);
  });

  it("keeps the first and last pages with a gap near the end", () => {
    expect(pageItems(7, 10)).toEqual([1, "gap", 6, 7, 8, 9, 10]);
    expect(pageItems(10, 10)).toEqual([1, "gap", 6, 7, 8, 9, 10]);
  });

  it("always takes seven places, so the buttons don't shift while paging", () => {
    for (let page = 1; page <= 20; page += 1) expect(pageItems(page, 20)).toHaveLength(7);
  });
});

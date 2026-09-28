import { describe, expect, it } from "vitest";
import { isActive } from "./nav";

describe("isActive", () => {
  it("matches Home only on the root path", () => {
    expect(isActive("/", { href: "/" })).toBe(true);
    expect(isActive("/visit", { href: "/" })).toBe(false);
  });

  it("matches a section and the pages under it", () => {
    expect(isActive("/visit", { href: "/visit" })).toBe(true);
    expect(isActive("/visit/parking", { href: "/visit" })).toBe(true);
  });

  it("doesn't match a path that only shares a prefix", () => {
    expect(isActive("/visitors", { href: "/visit" })).toBe(false);
  });

  it("matches the extra sections an item claims", () => {
    const thisWeek = { href: "/this-week", also: ["/events"] };
    expect(isActive("/events/fall-retreat", thisWeek)).toBe(true);
    expect(isActive("/eventsx", thisWeek)).toBe(false);
  });

  it("ignores a trailing slash", () => {
    expect(isActive("/visit/", { href: "/visit" })).toBe(true);
  });
});

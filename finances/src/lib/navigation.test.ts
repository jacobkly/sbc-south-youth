import { describe, expect, it } from "vitest";
import { findBackTarget, pageLabel } from "./navigation";

const APP = "https://finances.example.test";

describe("findBackTarget", () => {
  it("goes one step back to the page before", () => {
    const urls = [`${APP}/admin`, `${APP}/admin/requests/r1`];
    expect(findBackTarget(urls, 1)).toEqual({ steps: 1, href: "/admin" });
  });

  it("keeps the query, so a report comes back with the same filters", () => {
    const urls = [`${APP}/admin/reports?period=2026-q3&basis=paid`, `${APP}/admin/requests/r1`];
    expect(findBackTarget(urls, 1)).toEqual({ steps: 1, href: "/admin/reports?period=2026-q3&basis=paid" });
  });

  it("skips earlier copies of this page, like the one saving an edit leaves", () => {
    const urls = [`${APP}/admin`, `${APP}/admin/requests/r1`, `${APP}/admin/requests/r1`];
    expect(findBackTarget(urls, 2)).toEqual({ steps: 2, href: "/admin" });
  });

  it("uses the current entry, not the newest, after going back", () => {
    const urls = [`${APP}/admin/payees`, `${APP}/admin/payees/p1`, `${APP}/admin/requests/r1`];
    expect(findBackTarget(urls, 1)).toEqual({ steps: 1, href: "/admin/payees" });
  });

  it("has nothing to go back to when the page was opened first", () => {
    expect(findBackTarget([`${APP}/admin/requests/r1`], 0)).toBeNull();
    expect(findBackTarget([`${APP}/admin/requests/r1`, `${APP}/admin/requests/r1`], 1)).toBeNull();
  });

  it("won't go back to a page outside the app, like sign-in", () => {
    const urls = [`${APP}/admin`, `${APP}/login?next=%2Fadmin`, `${APP}/admin/requests/r1`];
    expect(findBackTarget(urls, 2)).toBeNull();
  });

  it("stops at an entry without a URL", () => {
    expect(findBackTarget([`${APP}/admin`, null, `${APP}/admin/payees/p1`], 2)).toBeNull();
    expect(findBackTarget([`${APP}/admin`, null], 1)).toBeNull();
  });

  it("doesn't treat a path that only starts with admin as the app", () => {
    expect(findBackTarget([`${APP}/administrator`, `${APP}/admin`], 1)).toBeNull();
  });
});

describe("pageLabel", () => {
  it("names the main pages", () => {
    expect(pageLabel("/admin")).toBe("Dashboard");
    expect(pageLabel("/admin/requests")).toBe("Requests");
    expect(pageLabel("/admin/requests/new")).toBe("New request");
    expect(pageLabel("/admin/payees")).toBe("Payees");
    expect(pageLabel("/admin/reports")).toBe("Reports");
    expect(pageLabel("/admin/settings")).toBe("Settings");
  });

  it("names one request or payee", () => {
    expect(pageLabel("/admin/requests/0b7f7c1e-4f5e-4f3a-9a7e-1f2d3c4b5a69")).toBe("Request");
    expect(pageLabel("/admin/payees/0b7f7c1e-4f5e-4f3a-9a7e-1f2d3c4b5a69")).toBe("Payee");
  });

  it("falls back to Back", () => {
    expect(pageLabel("/admin/requests/r1/edit")).toBe("Back");
    expect(pageLabel("/somewhere")).toBe("Back");
  });
});

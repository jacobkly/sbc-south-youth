import { describe, expect, it } from "vitest";
import type { SiteEvent, WeeklyGathering } from "./content/types";
import { PAGE_PATHS, eventPaths, isIndexable, robotsFor, sitemapEntries } from "./seo";

const live = { VERCEL: "1", VERCEL_ENV: "production", SITE_LIVE: "true" };

describe("isIndexable", () => {
  it("indexes only the live production site", () => {
    expect(isIndexable(live)).toBe(true);
  });

  it("keeps search engines out of the gated site, previews, and local builds", () => {
    expect(isIndexable({ VERCEL: "1", VERCEL_ENV: "production" })).toBe(false);
    expect(isIndexable({ VERCEL: "1", VERCEL_ENV: "preview", SITE_LIVE: "true" })).toBe(false);
    expect(isIndexable({ VERCEL: "1", SITE_LIVE: "true" })).toBe(false);
    expect(isIndexable({ SITE_LIVE: "true" })).toBe(false);
    expect(isIndexable({})).toBe(false);
  });
});

describe("robotsFor", () => {
  it("disallows everything when the site isn't indexable", () => {
    expect(robotsFor({ VERCEL: "1", VERCEL_ENV: "production" })).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });

  it("allows the live site and points to the sitemap", () => {
    expect(robotsFor(live)).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: "/coming-soon" },
      sitemap: "https://sbcsouthyouth.com/sitemap.xml",
    });
  });
});

describe("eventPaths", () => {
  const night = { slug: "weekly-hs" } as WeeklyGathering;
  const event = (slug: string, endsAt: string) => ({ slug, endsAt }) as SiteEvent;

  it("lists weekly nights and events that haven't ended", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    const events = [event("past", "2026-09-30T12:00:00Z"), event("now", "2026-10-01T12:00:00Z"), event("soon", "2026-10-05T03:00:00Z")];
    expect(eventPaths([night], events, now)).toEqual(["/events/weekly-hs", "/events/soon"]);
  });
});

describe("sitemapEntries", () => {
  it("makes every path an absolute URL on the site", () => {
    expect(sitemapEntries(["/", "/visit"])).toEqual([
      { url: "https://sbcsouthyouth.com/" },
      { url: "https://sbcsouthyouth.com/visit" },
    ]);
  });

  it("lists every page once, home first", () => {
    expect(PAGE_PATHS[0]).toBe("/");
    expect(new Set(PAGE_PATHS).size).toBe(PAGE_PATHS.length);
    expect(PAGE_PATHS).toContain("/this-week");
  });
});

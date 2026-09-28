import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { describe, expect, it } from "vitest";
import { COMING_SOON_PATH, gateRewrites, isGated } from "./launch-gate";

describe("isGated", () => {
  it("gates a Vercel production build until the site goes live", () => {
    expect(isGated({ VERCEL: "1", VERCEL_ENV: "production" })).toBe(true);
    expect(isGated({ VERCEL: "1", VERCEL_ENV: "production", SITE_LIVE: "false" })).toBe(true);
    expect(isGated({ VERCEL: "1", VERCEL_ENV: "production", SITE_LIVE: "TRUE" })).toBe(true);
    expect(isGated({ VERCEL: "1", VERCEL_ENV: "production", SITE_LIVE: "true" })).toBe(false);
  });

  it("fails closed on Vercel when the environment name is missing", () => {
    expect(isGated({ VERCEL: "1" })).toBe(true);
  });

  it("shows the full site on previews and local builds", () => {
    expect(isGated({ VERCEL: "1", VERCEL_ENV: "preview" })).toBe(false);
    expect(isGated({})).toBe(false);
    expect(isGated({ NODE_ENV: "production" })).toBe(false);
  });
});

describe("gateRewrites", () => {
  it("adds nothing when the site isn't gated", () => {
    expect(gateRewrites(false)).toEqual([]);
  });

  it("sends every page to the coming-soon page", () => {
    const rewrites = gateRewrites(true);
    expect(rewrites.every((rewrite) => rewrite.destination === COMING_SOON_PATH)).toBe(true);
  });

  // Matches sources the way Next matches rewrites.
  const matchers = gateRewrites(true).map((rewrite) =>
    getPathMatch(rewrite.source, { strict: true, removeUnnamedParams: true }),
  );
  const isRewritten = (pathname: string) => matchers.some((match) => match(pathname) !== false);

  it.each(["/", "/visit", "/events/fall-retreat", "/this-week", "/coming-soon", "/Visit", "/visit/"])(
    "rewrites the page %s",
    (pathname) => {
      expect(isRewritten(pathname)).toBe(true);
    },
  );

  it.each([
    "/_next/static/chunks/main.js",
    "/_next/image",
    "/_next/data/build/index.json",
    "/_vercel/insights/script.js",
    "/favicon.ico",
    "/icon.png",
    "/apple-icon.png",
    "/opengraph-image.png",
    "/robots.txt",
    "/sitemap.xml",
    "/events/fall-retreat/calendar.ics",
    "/.well-known/security.txt",
  ])("leaves the file %s alone", (pathname) => {
    expect(isRewritten(pathname)).toBe(false);
  });
});

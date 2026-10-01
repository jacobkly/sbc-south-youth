import type { IncomingMessage } from "node:http";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { modifyRouteRegex } from "next/dist/lib/redirect-status";
import { matchHas, prepareDestination } from "next/dist/shared/lib/router/utils/prepare-destination";
import { describe, expect, it } from "vitest";
import { NO_PAGE_PATH, ON_PORTAL_HOST, portalHeaders, portalRewrites } from "./host";
import { COMING_SOON_PATH, gateRewrites } from "./launch-gate";

type Condition = { type: "host"; value: string };
type Rule = { source: string; has?: Condition[]; missing?: Condition[] };

/** A rule's params when its path and host conditions match, the way Next checks them. */
function matches(rule: Rule, host: string, pathname: string): Record<string, string | string[]> | false {
  const match = getPathMatch(rule.source, {
    strict: true,
    removeUnnamedParams: true,
    // Next lets every rule end with an optional slash.
    regexModifier: (regex) => modifyRouteRegex(regex),
  });
  const params = match(pathname);
  if (params === false) return false;
  const request = { headers: { host } } as unknown as IncomingMessage;
  const hostParams = matchHas(request, {}, rule.has, rule.missing);
  return hostParams === false ? false : { ...params, ...hostParams };
}

/**
 * The path Next renders for a request, given the site's `beforeFiles`
 * rewrites in next.config's order. Like Next, it runs every rule in turn
 * on the path the rule before it left, not just the first match.
 */
function route(host: string, pathname: string, { gated }: { gated: boolean }): string {
  let path = pathname;
  for (const rewrite of [...portalRewrites(), ...gateRewrites(gated)]) {
    const params = matches(rewrite, host, path);
    if (params === false) continue;
    path = prepareDestination({ appendParamsToQuery: true, destination: rewrite.destination, params, query: {} })
      .parsedDestination.pathname;
  }
  return path;
}

const PORTAL = "portal.sbcsouthyouth.com";
const PUBLIC = "sbcsouthyouth.com";
// The portal's catch-all page, which answers with the portal's 404.
const PORTAL_404 = `/portal${NO_PAGE_PATH}`;

describe("the portal host", () => {
  const isPortal = (host: string) => matches({ source: "/", has: ON_PORTAL_HOST }, host, "/") !== false;

  it.each([PORTAL, "portal.localhost:3001", "PORTAL.sbcsouthyouth.com", "portal-staging.sbcsouthyouth.com"])(
    "is %s",
    (host) => {
      expect(isPortal(host)).toBe(true);
    },
  );

  it.each([
    PUBLIC,
    "www.sbcsouthyouth.com",
    "staging.sbcsouthyouth.com",
    "finances.sbcsouthyouth.com",
    "localhost:3001",
    "myportal.sbcsouthyouth.com",
    "portalx.localhost",
    "portal",
  ])("isn't %s", (host) => {
    expect(isPortal(host)).toBe(false);
  });
});

describe.each([{ gated: false }, { gated: true }])("routing with the gate %o", (gate) => {
  it.each([
    ["/", "/portal"],
    ["/people", "/portal/people"],
    ["/people/some-id", "/portal/people/some-id"],
    ["/coming-soon", "/portal/coming-soon"],
    ["/visit", "/portal/visit"],
  ])("serves %s on the portal host from %s", (pathname, page) => {
    expect(route(PORTAL, pathname, gate)).toBe(page);
    expect(route("portal.localhost:3001", pathname, gate)).toBe(page);
  });

  it("gives the portal host its own robots.txt and no sitemap", () => {
    expect(route(PORTAL, "/robots.txt", gate)).toBe("/portal/robots.txt");
    expect(route(PORTAL, "/sitemap.xml", gate)).toBe(PORTAL_404);
  });

  it.each(["/portal", "/portal/", "/portal/people", NO_PAGE_PATH])(
    "gives %s on the portal host the portal's 404",
    (pathname) => {
      expect(route(PORTAL, pathname, gate)).toBe(PORTAL_404);
    },
  );

  it.each([
    "/_next/static/chunks/main.js",
    "/_next/image",
    "/_vercel/insights/script.js",
    "/favicon.ico",
    "/icon.png",
    "/apple-icon.png",
    "/manifest.webmanifest",
  ])("leaves the file %s alone on the portal host", (pathname) => {
    expect(route(PORTAL, pathname, gate)).toBe(pathname);
  });

  it.each(["/portal", "/portal/", "/portal/people", "/portal/robots.txt"])(
    "hides %s on every other host",
    (pathname) => {
      for (const host of [PUBLIC, "localhost:3001", "staging.sbcsouthyouth.com"]) {
        expect(route(host, pathname, gate)).toBe(gate.gated ? COMING_SOON_PATH : NO_PAGE_PATH);
      }
    },
  );

  it("doesn't mistake other pages for the portal", () => {
    expect(route(PUBLIC, "/portals", gate)).not.toBe(NO_PAGE_PATH);
  });
});

describe("routing on the public host", () => {
  it("shows the full site when the gate is open", () => {
    expect(route(PUBLIC, "/", { gated: false })).toBe("/");
    expect(route(PUBLIC, "/visit", { gated: false })).toBe("/visit");
    expect(route(PUBLIC, "/robots.txt", { gated: false })).toBe("/robots.txt");
  });

  it("shows coming soon when the gate is closed", () => {
    expect(route(PUBLIC, "/", { gated: true })).toBe(COMING_SOON_PATH);
    expect(route(PUBLIC, "/visit", { gated: true })).toBe(COMING_SOON_PATH);
  });
});

describe("NO_PAGE_PATH", () => {
  it("is a private folder name, so no page can ever claim it", () => {
    expect(NO_PAGE_PATH).toMatch(/^\/_[^/]+$/);
  });
});

describe("portalHeaders", () => {
  const headersFor = (host: string, pathname: string) =>
    portalHeaders()
      .filter((rule) => matches(rule, host, pathname) !== false)
      .flatMap((rule) => rule.headers);

  it("keeps search engines off every portal response", () => {
    for (const pathname of ["/", "/people", "/robots.txt", "/_next/static/chunks/main.js"]) {
      expect(headersFor(PORTAL, pathname)).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" });
    }
  });

  it("adds nothing on the public host", () => {
    expect(headersFor(PUBLIC, "/")).toEqual([]);
    expect(headersFor("localhost:3001", "/visit")).toEqual([]);
  });
});

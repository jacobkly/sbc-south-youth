import type { IncomingMessage } from "node:http";
import * as pageStaticInfo from "next/dist/build/analysis/get-page-static-info";
import type { ProxyMatcher } from "next/dist/build/analysis/get-page-static-info";
import { getMiddlewareRouteMatcher } from "next/dist/shared/lib/router/utils/middleware-route-matcher";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { modifyRouteRegex } from "next/dist/lib/redirect-status";
import { matchHas, prepareDestination } from "next/dist/shared/lib/router/utils/prepare-destination";
import { describe, expect, it } from "vitest";
import { config as proxyConfig } from "@/proxy";
import { NO_PAGE_PATH, ON_PORTAL_HOST, portalRewrites, publicSiteUrl, siteHeaders } from "./host";
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

describe("publicSiteUrl", () => {
  it.each([
    ["https://portal.sbcsouthyouth.com", "https://sbcsouthyouth.com"],
    ["http://portal.localhost:3001", "http://localhost:3001"],
    ["https://portal-staging.sbcsouthyouth.com", "https://staging.sbcsouthyouth.com"],
  ])("takes the portal off %s", (portal, site) => {
    expect(publicSiteUrl(portal)).toBe(site);
  });

  it("falls back to the real site for an address that isn't the portal's", () => {
    expect(publicSiteUrl("https://example.com")).toBe("https://sbcsouthyouth.com");
    expect(publicSiteUrl("not a url")).toBe("https://sbcsouthyouth.com");
  });
});

describe("NO_PAGE_PATH", () => {
  it("is a private folder name, so no page can ever claim it", () => {
    expect(NO_PAGE_PATH).toMatch(/^\/_[^/]+$/);
  });
});

describe("siteHeaders", () => {
  const mode = { dev: false, https: true };
  const SUPABASE = "https://example-ref.supabase.co";
  const rulesFor = (host: string, pathname: string, supabaseUrl: string | null = SUPABASE) =>
    siteHeaders(mode, supabaseUrl ?? undefined).filter((rule) => matches(rule, host, pathname) !== false);
  // Like Next, a later rule's header replaces an earlier one's with the same key.
  const headersFor = (host: string, pathname: string, supabaseUrl: string | null = SUPABASE) => [
    ...new Map(
      rulesFor(host, pathname, supabaseUrl)
        .flatMap((rule) => rule.headers)
        .map((header) => [header.key, header]),
    ).values(),
  ];
  const header = (host: string, pathname: string, key: string) =>
    headersFor(host, pathname).find((found) => found.key === key)?.value;
  const directive = (host: string, pathname: string, name: string) =>
    header(host, pathname, "Content-Security-Policy")
      ?.split("; ")
      .find((found) => found.startsWith(`${name} `));
  const policies = (headers: { key: string; value: string }[]) =>
    headers.filter((header) => header.key === "Content-Security-Policy").map((header) => header.value);
  const connectSrc = (policy: string) => policy.split("; ").find((directive) => directive.startsWith("connect-src "));

  it("keeps search engines off every portal response", () => {
    for (const pathname of ["/", "/people", "/robots.txt", "/_next/static/chunks/main.js"]) {
      expect(headersFor(PORTAL, pathname)).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" });
    }
  });

  it("adds nothing portal-only on the public host", () => {
    for (const host of [PUBLIC, "localhost:3001"]) {
      expect(headersFor(host, "/visit").map((header) => header.key)).not.toContain("X-Robots-Tag");
    }
  });

  it("sends each response exactly one policy, since browsers enforce every one they get", () => {
    for (const host of [PORTAL, "portal.localhost:3001", PUBLIC, "localhost:3001"]) {
      expect(policies(rulesFor(host, "/").flatMap((rule) => rule.headers))).toHaveLength(1);
    }
  });

  it("lets the portal frame only its own preview page", () => {
    expect(directive(PORTAL, "/posts/new", "frame-src")).toBe("frame-src 'self'");
    expect(directive(PORTAL, "/posts/new", "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(header(PORTAL, "/posts/new", "X-Frame-Options")).toBe("DENY");
    expect(directive(PORTAL, "/preview", "frame-ancestors")).toBe("frame-ancestors 'self'");
    expect(header(PORTAL, "/preview", "X-Frame-Options")).toBe("SAMEORIGIN");
    expect(header(PORTAL, "/preview", "X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("never lets the public site frame anything but Turnstile, or be framed", () => {
    for (const pathname of ["/", "/preview", "/events/beach-day"]) {
      expect(directive(PUBLIC, pathname, "frame-src")).toBe("frame-src https://challenges.cloudflare.com");
      expect(directive(PUBLIC, pathname, "frame-ancestors")).toBe("frame-ancestors 'none'");
      expect(header(PUBLIC, pathname, "X-Frame-Options")).toBe("DENY");
    }
  });

  it("lets only the portal's pages talk to Supabase", () => {
    expect(connectSrc(policies(headersFor(PORTAL, "/people"))[0])).toBe(`connect-src 'self' ${SUPABASE}`);
    expect(connectSrc(policies(headersFor(PUBLIC, "/"))[0])).toBe("connect-src 'self'");
    expect(connectSrc(policies(headersFor("portal.localhost:3001", "/", "http://127.0.0.1:54321/"))[0])).toBe(
      "connect-src 'self' http://127.0.0.1:54321",
    );
  });

  it("lets only the portal's pages show photos picked on the device", () => {
    expect(directive(PORTAL, "/photos", "img-src")).toBe(`img-src 'self' data: blob: ${SUPABASE}`);
    expect(directive(PORTAL, "/preview", "img-src")).toBe(`img-src 'self' data: blob: ${SUPABASE}`);
    const local = policies(headersFor("portal.localhost:3001", "/account", null))[0];
    expect(local.split("; ").find((found) => found.startsWith("img-src "))).toBe("img-src 'self' data: blob:");
  });

  it("lets the public pages show the site's photos from Supabase Storage", () => {
    for (const pathname of ["/", "/give", "/events/beach-day"]) {
      expect(directive(PUBLIC, pathname, "img-src")).toBe(`img-src 'self' data: ${SUPABASE}`);
    }
    const local = policies(headersFor("localhost:3001", "/", "http://127.0.0.1:54321/"))[0];
    expect(local.split("; ").find((found) => found.startsWith("img-src "))).toBe(
      "img-src 'self' data: http://127.0.0.1:54321",
    );
    const unset = policies(headersFor("localhost:3001", "/", null))[0];
    expect(unset.split("; ").find((found) => found.startsWith("img-src "))).toBe("img-src 'self' data:");
  });

  it("lets every public page load Turnstile, since a link opens a form page without a reload", () => {
    const turnstile = "https://challenges.cloudflare.com";
    for (const host of [PUBLIC, "localhost:3001"]) {
      for (const pathname of ["/", "/visit", "/connect", "/contact", "/events/beach-day"]) {
        expect(directive(host, pathname, "script-src")).toContain(turnstile);
        expect(directive(host, pathname, "frame-src")).toBe(`frame-src ${turnstile}`);
        expect(directive(host, pathname, "connect-src")).toBe("connect-src 'self'");
      }
    }
    for (const pathname of ["/", "/visit", "/contact", "/preview"]) {
      expect(directive(PORTAL, pathname, "script-src")).not.toContain(turnstile);
      expect(directive(PORTAL, pathname, "frame-src")).not.toContain(turnstile);
    }
  });

  it("leaves Supabase out when its URL isn't set", () => {
    expect(connectSrc(policies(headersFor(PORTAL, "/", null))[0])).toBe("connect-src 'self'");
  });
});

describe("the proxy", () => {
  // Next turns the matcher into this check when it builds the proxy. It
  // doesn't publish a type for the first step.
  const { getMiddlewareMatchers } = pageStaticInfo as unknown as {
    getMiddlewareMatchers: (matcher: unknown, nextConfig: unknown) => ProxyMatcher[];
  };
  const runs = getMiddlewareRouteMatcher(getMiddlewareMatchers(proxyConfig.matcher, {}));
  const runsOn = (host: string, pathname: string) =>
    runs(pathname, { headers: { host } } as unknown as Parameters<typeof runs>[1], {});

  it("runs on every portal page, to keep the session fresh", () => {
    for (const pathname of ["/", "/people", "/people/some-id", "/login", "/auth/callback"]) {
      expect(runsOn(PORTAL, pathname)).toBe(true);
      expect(runsOn("portal.localhost:3001", pathname)).toBe(true);
    }
  });

  it("never runs on another host, so the public site never touches Supabase or sets a cookie", () => {
    for (const host of [PUBLIC, "localhost:3001", "staging.sbcsouthyouth.com", "finances.sbcsouthyouth.com"]) {
      for (const pathname of ["/", "/visit", "/login", "/portal", "/portal/login"]) {
        expect(runsOn(host, pathname)).toBe(false);
      }
    }
  });

  it.each([
    "/_next/static/chunks/main.js",
    "/_next/image",
    "/_vercel/insights/script.js",
    "/favicon.ico",
    "/icon.png",
    "/robots.txt",
    "/manifest.webmanifest",
  ])("skips the file %s", (pathname) => {
    expect(runsOn(PORTAL, pathname)).toBe(false);
  });

  it("uses the same portal host rule as the rewrites", () => {
    expect(proxyConfig.matcher.every((rule) => JSON.stringify(rule.has) === JSON.stringify(ON_PORTAL_HOST))).toBe(true);
  });
});

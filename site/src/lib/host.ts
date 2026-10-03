import { securityHeaders, type HeaderMode } from "./security-headers";

/**
 * The leader portal is part of this app but lives on its own host. Its
 * pages sit under a real `/portal` folder, and these rewrites serve that
 * folder at the root of the portal host and hide it everywhere else.
 *
 * It's all `next.config` rewrites and headers, decided at build time and
 * matched before any app code runs. The proxy, which keeps the portal's
 * sign-in fresh, matches the portal host too, so the public host never
 * runs portal code, touches Supabase, or sets a cookie.
 */

/**
 * A host whose first label is `portal`, or starts with `portal-` for
 * another environment: `portal.sbcsouthyouth.com`, `portal.localhost`.
 * Next drops the port, lowercases the host, and matches the whole of it.
 */
export const PORTAL_HOST = String.raw`portal(?:-[a-z0-9-]+)?\..+`;

export const ON_PORTAL_HOST = [{ type: "host" as const, value: PORTAL_HOST }];

/**
 * Every path except the root, Next's own files, Vercel's scripts, and
 * anything with a file extension (icons, the share image, robots.txt,
 * calendar files).
 */
export const PAGE_PATH = String.raw`/:path((?!_next/|_vercel/)(?!.*\.[^/]+$).+)`;

/**
 * Where a rewrite sends a path that shouldn't exist. Folders starting with
 * an underscore are private in the App Router, so no page can claim it and
 * Next answers with its 404.
 */
export const NO_PAGE_PATH = "/_no-page";

type HostCondition = (typeof ON_PORTAL_HOST)[number];
type Rewrite = { source: string; destination: string; has?: HostCondition[]; missing?: HostCondition[] };

/**
 * `beforeFiles` rewrites that put the portal on its host and nowhere else.
 * Next runs every one in order on the path the one before left, so the
 * order matters.
 */
export function portalRewrites(): Rewrite[] {
  return [
    // No host reaches the folder by its real path. On the portal host, the
    // page rule below then sends this to the portal's 404.
    { source: "/portal/:path*", destination: NO_PAGE_PATH },
    // Search engines stay out of the portal, which has nothing to list.
    { source: "/robots.txt", has: ON_PORTAL_HOST, destination: "/portal/robots.txt" },
    { source: "/sitemap.xml", has: ON_PORTAL_HOST, destination: NO_PAGE_PATH },
    { source: PAGE_PATH, has: ON_PORTAL_HOST, destination: "/portal/:path" },
    // Last, so no rule here sees the path it makes.
    { source: "/", has: ON_PORTAL_HOST, destination: "/portal" },
  ];
}

type HeaderRule = {
  source: string;
  has?: HostCondition[];
  missing?: HostCondition[];
  headers: { key: string; value: string }[];
};

/**
 * Headers for every response. Each host gets its own security policy,
 * since a browser enforces every policy it's sent: the portal's lets its
 * pages call Supabase, and the public site's never does.
 */
export function siteHeaders(mode: HeaderMode, supabaseUrl: string | undefined): HeaderRule[] {
  const connect = supabaseUrl ? [new URL(supabaseUrl).origin] : [];
  return [
    { source: "/:path*", missing: ON_PORTAL_HOST, headers: securityHeaders(mode) },
    {
      source: "/:path*",
      has: ON_PORTAL_HOST,
      headers: [...securityHeaders({ ...mode, connect }), { key: "X-Robots-Tag", value: "noindex, nofollow" }],
    },
  ];
}

/**
 * The launch gate. Until the site goes live, a Vercel production build
 * serves the coming-soon page for every page, while previews and local
 * builds show the full site.
 *
 * It's decided at build time from the environment Vercel builds with, so
 * no request-time code can quietly fail open. To launch, set
 * `SITE_LIVE=true` on the site's Vercel project and redeploy.
 */

import { ON_PORTAL_HOST, PAGE_PATH } from "./host";

export const COMING_SOON_PATH = "/coming-soon";

type BuildEnv = Partial<Record<"VERCEL" | "VERCEL_ENV" | "SITE_LIVE", string>> & Record<string, string | undefined>;

/**
 * True for a Vercel build that isn't a preview, unless the site is live.
 * A Vercel build without `VERCEL_ENV` counts as production, so a missing
 * variable keeps the gate closed.
 */
export function isGated(env: BuildEnv): boolean {
  const onVercel = env.VERCEL === "1";
  return onVercel && env.VERCEL_ENV !== "preview" && env.SITE_LIVE !== "true";
}

type Rewrite = { source: string; destination: string; missing: typeof ON_PORTAL_HOST };

/**
 * `beforeFiles` rewrites that send every page to the coming-soon page.
 * The leader portal has its own host and stays open.
 */
export function gateRewrites(gated: boolean): Rewrite[] {
  if (!gated) return [];
  return [
    { source: "/", missing: ON_PORTAL_HOST, destination: COMING_SOON_PATH },
    { source: PAGE_PATH, missing: ON_PORTAL_HOST, destination: COMING_SOON_PATH },
  ];
}

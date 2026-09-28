/**
 * The launch gate. Until the site goes live, a Vercel production build
 * serves the coming-soon page for every page, while previews and local
 * builds show the full site.
 *
 * It's decided at build time from the environment Vercel builds with, so
 * no request-time code can quietly fail open. To launch, set
 * `SITE_LIVE=true` on the site's Vercel project and redeploy.
 */

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

/**
 * Every path except Next's own files, Vercel's scripts, and anything with
 * a file extension (icons, the share image, robots.txt, calendar files).
 */
const PAGE_PATH = String.raw`/:path((?!_next/|_vercel/)(?!.*\.[^/]+$).*)`;

/** `beforeFiles` rewrites that send every page to the coming-soon page. */
export function gateRewrites(gated: boolean): { source: string; destination: string }[] {
  if (!gated) return [];
  return [
    { source: "/", destination: COMING_SOON_PATH },
    { source: PAGE_PATH, destination: COMING_SOON_PATH },
  ];
}

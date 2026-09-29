import type { MetadataRoute } from "next";
import { pages } from "@/content/pages";
import { site } from "@/content/site";
import type { SiteEvent, WeeklyGathering } from "./content/types";
import { COMING_SOON_PATH, isGated } from "./launch-gate";

type BuildEnv = Parameters<typeof isGated>[0];

/**
 * Only the live production site gets indexed. Previews, local builds,
 * and the site behind the launch gate ask search engines to stay out,
 * so they never index a copy or a page of "coming soon".
 */
export function isIndexable(env: BuildEnv): boolean {
  return env.VERCEL === "1" && env.VERCEL_ENV === "production" && !isGated(env);
}

export function robotsFor(env: BuildEnv): MetadataRoute.Robots {
  if (!isIndexable(env)) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: COMING_SOON_PATH },
    sitemap: new URL("/sitemap.xml", site.url).toString(),
  };
}

/** Every page, home first. */
export const PAGE_PATHS = ["/", ...Object.values(pages).map((page) => page.path)];

/** Weekly nights and events that haven't ended. Past events keep their pages but leave the sitemap. */
export function eventPaths(schedule: WeeklyGathering[], events: SiteEvent[], now: Date): string[] {
  const upcoming = events.filter((event) => Date.parse(event.endsAt) > now.getTime());
  return [...schedule, ...upcoming].map((entry) => `/events/${entry.slug}`);
}

export function sitemapEntries(paths: string[]): MetadataRoute.Sitemap {
  return paths.map((path) => ({ url: new URL(path, site.url).toString() }));
}

import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { getEvents, getSchedule } from "@/lib/content/loaders";
import { PAGE_PATHS, eventPaths, sitemapEntries } from "@/lib/seo";

/** Cached like the feed, so events drop off after they end. */
async function upcomingEventPaths(): Promise<string[]> {
  "use cache";
  cacheLife("feed");
  const [schedule, events] = await Promise.all([getSchedule(), getEvents()]);
  return eventPaths(schedule, events, new Date());
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return sitemapEntries([...PAGE_PATHS, ...(await upcomingEventPaths())]);
}

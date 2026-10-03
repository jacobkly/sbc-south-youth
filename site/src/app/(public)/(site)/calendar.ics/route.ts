import { cacheLife } from "next/cache";
import { formatAddress, site } from "@/content/site";
import { getEvents, getSchedule } from "@/lib/content/loaders";
import { calendarFile, calendarResponse, feedEntries } from "@/lib/ics";

/**
 * The calendar people subscribe to. Calendar apps check back on their
 * own, so new, changed, and cancelled events reach them without a new
 * file. It's cached for 15 minutes, and a portal change to an event
 * refreshes it right away through the loader's `events` tag.
 */
async function feed(): Promise<string> {
  "use cache";
  cacheLife("calendar");

  const now = new Date();
  const [gatherings, events] = await Promise.all([getSchedule(), getEvents()]);
  return calendarFile(feedEntries(gatherings, events, formatAddress(), now), { stamp: now, name: site.name });
}

export async function GET() {
  return calendarResponse(await feed(), "sbc-south-youth.ics", "inline");
}

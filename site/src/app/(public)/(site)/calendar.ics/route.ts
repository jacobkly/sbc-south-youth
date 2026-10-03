import { cacheLife } from "next/cache";
import { formatAddress, site } from "@/content/site";
import { getEvents, getSchedule } from "@/lib/content/loaders";
import { calendarFile, calendarResponse, eventEntry, gatheringEntry } from "@/lib/ics";

/** How long past events stay on subscribers' calendars, in days. */
const KEEP_PAST_DAYS = 30;

/**
 * The calendar people subscribe to: the weekly nights, then every event
 * that hasn't ended or ended in the last month. Calendar apps check back
 * on their own, so new and changed events show up without a new file,
 * and a cancelled one drops off.
 */
async function feed(): Promise<string> {
  "use cache";
  cacheLife("feed");

  const now = new Date();
  const since = now.getTime() - KEEP_PAST_DAYS * 86_400_000;
  const [gatherings, events] = await Promise.all([getSchedule(), getEvents()]);
  const church = formatAddress();
  const entries = [
    ...gatherings.map((gathering) => gatheringEntry(gathering, church, now)),
    ...events
      .filter((event) => !event.cancelled && Date.parse(event.endsAt) > since)
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      .map((event) => eventEntry(event, church)),
  ];
  return calendarFile(entries, { stamp: now, name: site.name });
}

export async function GET() {
  return calendarResponse(await feed(), "sbc-south-youth.ics", "inline");
}

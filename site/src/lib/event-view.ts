import { cacheLife } from "next/cache";
import { formatAddress } from "@/content/site";
import { getBySlug } from "./content/loaders";
import type { Photo } from "./content/types";
import { todayInLA, type IsoDate } from "./dates";
import { eventItem, itemAddress, itemDateLabel, itemTimeLabel, upcomingItems, type FeedItem } from "./feed";
import { eventEntry, gatheringEntry, googleCalendarUrl } from "./ics";
import { eventJsonLd } from "./json-ld";
import { formatClockRange, weekdayName } from "./schedule";

/** How many upcoming nights a weekly page lists. */
const NIGHTS_SHOWN = 4;

/**
 * Everything an `/events/[slug]` page shows, for a one-off event or a
 * weekly night. Its metadata and link preview read it too.
 */
export type EventView = {
  slug: string;
  title: string;
  description?: string;
  photo?: Photo;
  featured: boolean;
  weekly: boolean;
  /** "Saturday, October 10", or "Every Friday". */
  date: string;
  /** "9 AM–12 PM". */
  time: string;
  locationName?: string;
  address?: string;
  costNote?: string;
  /** When the calendar buttons give way to "already happened". Weekly nights don't end. */
  endsAt: number | null;
  ended: boolean;
  googleCalendar: string;
  /** The next few weekly nights, plus one spare in case the first ends while the page is open. */
  nights: FeedItem[];
  today: IsoDate;
  /** For search engines: the event, or a weekly gathering's next night. */
  jsonLd: ReturnType<typeof eventJsonLd> | null;
};

/**
 * Cached like the feed, so the dates and "already happened" stay current
 * as the page is rebuilt. The browser hides the calendar buttons if the
 * event ends between rebuilds.
 */
export async function eventView(slug: string): Promise<EventView | null> {
  "use cache";
  cacheLife("feed");

  const content = await getBySlug(slug);
  if (!content) return null;
  const now = new Date();
  const today = todayInLA(now);
  const church = formatAddress();

  if (content.kind === "gathering") {
    const { gathering } = content;
    const nights = upcomingItems({ gatherings: [gathering], events: [], now, days: 7 * (NIGHTS_SHOWN + 1) }).slice(
      0,
      NIGHTS_SHOWN + 1,
    );
    return {
      slug,
      title: gathering.title,
      description: gathering.description,
      photo: gathering.photo,
      featured: false,
      weekly: true,
      date: `Every ${weekdayName(gathering.weekday)}`,
      time: formatClockRange(gathering.startTime, gathering.endTime),
      locationName: gathering.locationName,
      address: church,
      endsAt: null,
      ended: false,
      googleCalendar: googleCalendarUrl(gatheringEntry(gathering, church, now)),
      nights,
      today,
      jsonLd: nights[0] ? eventJsonLd(nights[0], { description: gathering.description, address: church }) : null,
    };
  }

  const { event } = content;
  const item = eventItem(event);
  const endsAt = Date.parse(event.endsAt);
  const address = itemAddress(item, church);
  return {
    slug,
    title: event.title,
    description: event.description,
    photo: event.photo,
    featured: event.featured,
    weekly: false,
    date: itemDateLabel(item, today),
    time: itemTimeLabel(item),
    locationName: event.locationName,
    address,
    costNote: event.costNote,
    endsAt,
    ended: endsAt <= now.getTime(),
    googleCalendar: googleCalendarUrl(eventEntry(event, church)),
    nights: [],
    today,
    jsonLd: eventJsonLd(item, { description: event.description, address }),
  };
}

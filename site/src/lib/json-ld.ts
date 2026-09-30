import { site } from "@/content/site";
import { addDays, laDateOf } from "./dates";
import type { FeedItem } from "./feed";

/**
 * Structured data that tells search engines what a page is about, so an
 * event can show up with its date and place.
 */

type EventJsonLd = {
  "@context": "https://schema.org";
  "@type": "Event";
  name: string;
  description?: string;
  /** A date for all-day events, or a UTC instant. */
  startDate: string;
  endDate: string;
  eventStatus: string;
  eventAttendanceMode: string;
  location?: { "@type": "Place"; name: string; address: string };
  image?: string[];
  organizer: { "@type": "Organization"; name: string; url: string };
  url: string;
};

/**
 * An event, or one night of a weekly gathering, as a schema.org Event.
 * Without an address the place isn't set yet, so it's left out.
 */
export function eventJsonLd(item: FeedItem, { description, address }: { description?: string; address?: string }): EventJsonLd {
  // An all-day event ends at midnight after its last day.
  const lastDay = addDays(laDateOf(item.endsAt), -1);
  const [startDate, endDate] = item.allDay
    ? [item.date, lastDay < item.date ? item.date : lastDay]
    : [item.startsAt, item.endsAt];

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: item.title,
    ...(description && { description }),
    startDate,
    endDate,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(address && { location: { "@type": "Place", name: item.locationName ?? site.campus, address } }),
    ...(item.photo && { image: [item.photo.src] }),
    organizer: { "@type": "Organization", name: site.name, url: site.url },
    url: `${site.url}/events/${item.slug}`,
  };
}

/** JSON for a script tag, with `<` escaped so no text in it can close the tag. */
export function jsonLdScript(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

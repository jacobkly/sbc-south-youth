import type { Database } from "@/lib/database.types";
import type { Announcement, Photo, SiteEvent } from "./types";

/**
 * Rows from `site.public_events()` and `site.public_posts()`, turned into
 * the shapes the pages already use. Nothing here talks to the database,
 * so it's tested on its own.
 */

type Returns<Name extends keyof Database["site"]["Functions"]> =
  Database["site"]["Functions"][Name]["Returns"][number];

/** The generated types call every column a function returns non-null. These can be null. */
type WithNulls<Row, Key extends keyof Row> = Omit<Row, Key> & { [Column in Key]: Row[Column] | null };

export type EventRow = WithNulls<
  Returns<"public_events">,
  "summary" | "body" | "location_name" | "address" | "cost_note" | "cancel_reason"
>;

export type PostRow = WithNulls<Returns<"public_posts">, "link_url" | "link_label">;

/** What a heads-up's button says when its editor didn't name the link. */
const DEFAULT_LINK_LABEL = "Learn more";

/** The text, or nothing when it's empty or only spaces. */
function text(value: string | null): string | undefined {
  return value?.trim() ? value : undefined;
}

/** PostgREST's `+00:00` instants, written the way the rest of the site writes them. */
function instant(value: string): string {
  return new Date(value).toISOString();
}

/** An event row as the pages know it, with the photo to show, if any. */
export function eventFromRow(row: EventRow, photo?: Photo): SiteEvent {
  const description = text(row.body);
  const locationName = text(row.location_name);
  const locationAddress = text(row.address);
  const costNote = text(row.cost_note);
  const reason = text(row.cancel_reason);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    ...(description && { description }),
    startsAt: instant(row.starts_at),
    endsAt: instant(row.ends_at),
    allDay: row.all_day,
    ...(locationName && { locationName }),
    ...(locationAddress && { locationAddress }),
    ...(photo && { photo }),
    ...(costNote && { costNote }),
    featured: row.featured,
    ...(row.status === "cancelled" && { cancelled: reason ? { reason } : {} }),
    sequence: row.sequence,
  };
}

/** The slug of the event page a link opens, like `/events/fall-retreat`. */
const EVENT_LINK = /^\/events\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/**
 * A heads-up row as the pages know it. Heads-ups have no photos of their
 * own, so one that links to an event page shows that event's.
 */
export function announcementFromRow(row: PostRow, events: SiteEvent[]): Announcement {
  const href = text(row.link_url);
  const slug = href?.match(EVENT_LINK)?.[1];
  const photo = slug ? events.find((event) => event.slug === slug)?.photo : undefined;

  return {
    id: row.id,
    title: row.title,
    body: row.body,
    ...(photo && { photo }),
    pinned: row.pinned,
    ...(row.tone === "cancellation" && { changeOfPlans: true as const }),
    publishAt: instant(row.starts_at),
    expiresAt: instant(row.ends_at),
    ...(href && { cta: { label: text(row.link_label) ?? DEFAULT_LINK_LABEL, href } }),
  };
}

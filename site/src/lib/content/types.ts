/**
 * The content the site shows, shaped like the tables the portal will
 * store it in. Pages get events, announcements, and the schedule through
 * the loaders in this folder, so moving them to the database later
 * doesn't touch the pages.
 *
 * Instants are ISO 8601 strings with an offset, like
 * "2026-10-09T18:00:00-07:00". Wall-clock times are "HH:MM", 24-hour,
 * in Los Angeles time.
 */

/** Who something is for. `all` shows under every audience filter. */
export type Audience = "all" | "hs" | "college";

export type Photo = {
  src: string;
  alt: string;
  /** True until the photo is replaced with one of our own. */
  placeholder: boolean;
};

/** A night that repeats every week, like High School Youth Night. */
export type WeeklyGathering = {
  /** Starts with `weekly-`, which event slugs can't. */
  slug: string;
  title: string;
  audience: Audience;
  /** 0 is Sunday. */
  weekday: number;
  startTime: string;
  endTime: string;
  locationName: string;
  /** One or two sentences for the schedule and calendar files. */
  description: string;
  photo?: Photo;
};

/** A one-off event. Named so it doesn't shadow the DOM's `Event`. */
export type SiteEvent = {
  id: string;
  slug: string;
  /** Up to 80 characters. */
  title: string;
  /** Plain text with line breaks, up to 4,000 characters. */
  description?: string;
  startsAt: string;
  endsAt: string;
  /**
   * Shown as dates without times. Starts at midnight on the first day and
   * ends at midnight after the last, in Los Angeles time.
   */
  allDay: boolean;
  locationName?: string;
  locationAddress?: string;
  photo?: Photo;
  audience: Audience;
  /** Up to 60 characters, like "$40, due Nov 1". */
  costNote?: string;
  featured: boolean;
};

export type Announcement = {
  id: string;
  /** Up to 60 characters. */
  title: string;
  /** Up to 400 characters. */
  body: string;
  photo?: Photo;
  audience: Audience;
  pinned: boolean;
  publishAt: string;
  expiresAt: string;
  /** The label is up to 24 characters. */
  cta?: { label: string; href: string };
};

export type Leader = {
  slug: string;
  name: string;
  role: string;
  /** Two sentences. */
  bio: string;
  funFact: string;
  email?: string;
  photo?: Photo;
};

export type FaqItem = {
  question: string;
  /** Plain text. A blank line starts a new paragraph. */
  answer: string;
};

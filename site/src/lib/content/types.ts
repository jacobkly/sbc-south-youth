/**
 * The content the site shows. Pages get events, announcements, and the
 * schedule through the loaders in this folder: events and announcements
 * (heads-ups) come from the database, mapped to these shapes in rows.ts,
 * and the rest lives in `src/content/`.
 *
 * Instants are ISO 8601 strings with an offset, like
 * "2026-10-09T18:00:00-07:00". Wall-clock times are "HH:MM", 24-hour,
 * in Los Angeles time.
 */

export type Photo = {
  src: string;
  alt: string;
  /** True until the photo is replaced with one of our own. */
  placeholder: boolean;
};

/** A night that repeats every week, like Friday youth. */
export type WeeklyGathering = {
  /** Starts with `weekly-`, which event slugs can't. */
  slug: string;
  title: string;
  /** 0 is Sunday. */
  weekday: number;
  startTime: string;
  endTime: string;
  /** A room or area at the church. Left out when it's just "the church". */
  locationName?: string;
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
  /** One line, up to 160 characters, for link previews and search results. */
  summary?: string;
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
  /** Left out for rooms at the church, which use the church's address. */
  locationAddress?: string;
  photo?: Photo;
  /** Up to 60 characters, like "$40, due Nov 1". */
  costNote?: string;
  featured: boolean;
  /**
   * Set once it's called off. Its page stays up with a banner, but it
   * leaves the agenda and Home.
   */
  cancelled?: { reason?: string };
  /**
   * Goes up with every edit, so a calendar that already has the event
   * knows to take the newer one.
   */
  sequence?: number;
};

/** A heads-up. Its photo is the one of the event it links to, if any. */
export type Announcement = {
  id: string;
  /** Up to 80 characters. */
  title: string;
  /** Up to 280 characters. */
  body: string;
  photo?: Photo;
  pinned: boolean;
  /** A night that's called off or moved, which the site makes stand out. */
  changeOfPlans?: true;
  publishAt: string;
  expiresAt: string;
  /** The label is up to 24 characters. */
  cta?: { label: string; href: string };
};

/**
 * A Heads up note that's always true, like "bring a friend". It lives in
 * code, never expires, and shows after the posts.
 */
export type StandingNote = {
  id: string;
  title: string;
  body: string;
  photo?: Photo;
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

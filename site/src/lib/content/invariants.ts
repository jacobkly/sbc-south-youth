import type { Announcement, FaqItem, Leader, Photo, SiteEvent, WeeklyGathering } from "./types";

/**
 * Rules the content must follow, checked by the tests so a typo fails
 * the build instead of breaking a page. The event and heads-up limits
 * match their columns, so fixtures stay realistic; the database checks
 * the real ones itself.
 */

export type ContentBundle = {
  gatherings?: WeeklyGathering[];
  events?: SiteEvent[];
  announcements?: Announcement[];
  leaders?: Leader[];
  faq?: FaqItem[];
  photos?: Photo[];
  /** Any other content, only scanned for chat invite links. */
  extra?: unknown;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

// Group chat links must never be on the site. A leader sends them one to one.
const CHAT_INVITES = [
  /chat\.whatsapp\.com/i,
  /groupme\.com\/join/i,
  /discord\.gg\//i,
  /discord(app)?\.com\/invite/i,
  /\bt\.me\/(\+|joinchat)/i,
  /\big\.me\/j\//i,
  /\bm\.me\/j\//i,
];

export function contentProblems(content: ContentBundle): string[] {
  const problems: string[] = [];
  const { gatherings = [], events = [], announcements = [], leaders = [], faq = [], photos = [] } = content;

  // Events and gatherings share the /events/[slug] URLs.
  const slugs = new Set<string>();
  function checkSlug(label: string, slug: string, seen = slugs) {
    if (!SLUG.test(slug)) problems.push(`${label}: slug must be lowercase words and dashes`);
    if (seen.has(slug)) problems.push(`${label}: slug "${slug}" is used twice`);
    seen.add(slug);
  }

  function checkPhoto(label: string, photo: Photo | undefined) {
    if (!photo) return;
    if (!photo.alt.trim()) problems.push(`${label}: photo needs alt text`);
    if (!photo.src.startsWith("https://") && !photo.src.startsWith("/")) {
      problems.push(`${label}: photo src must be https or a local path`);
    }
  }

  function checkLength(label: string, field: string, value: string | undefined, max: number) {
    if (value !== undefined && value.length > max) problems.push(`${label}: ${field} is over ${max} characters`);
  }

  function checkInstant(label: string, field: string, value: string): number {
    if (!INSTANT.test(value)) {
      problems.push(`${label}: ${field} needs a full date, time, and offset, like 2026-10-09T18:00:00-07:00`);
      return NaN;
    }
    return Date.parse(value);
  }

  for (const gathering of gatherings) {
    const label = `gathering "${gathering.slug}"`;
    checkSlug(label, gathering.slug);
    if (!gathering.slug.startsWith("weekly-")) problems.push(`${label}: slug must start with weekly-`);
    if (!Number.isInteger(gathering.weekday) || gathering.weekday < 0 || gathering.weekday > 6) {
      problems.push(`${label}: weekday must be 0 (Sunday) to 6 (Saturday)`);
    }
    const timesValid = TIME.test(gathering.startTime) && TIME.test(gathering.endTime);
    if (!timesValid) problems.push(`${label}: start and end time must be HH:MM, 24-hour`);
    else if (gathering.endTime <= gathering.startTime) problems.push(`${label}: ends before it starts`);
    checkPhoto(label, gathering.photo);
  }

  const eventIds = new Set<string>();
  for (const event of events) {
    const label = `event "${event.slug}"`;
    checkSlug(label, event.slug);
    if (event.slug.startsWith("weekly-")) problems.push(`${label}: the weekly- prefix is only for gatherings`);
    if (eventIds.has(event.id)) problems.push(`${label}: id "${event.id}" is used twice`);
    eventIds.add(event.id);
    checkLength(label, "title", event.title, 80);
    checkLength(label, "description", event.description, 4000);
    checkLength(label, "cost note", event.costNote, 60);
    const starts = checkInstant(label, "startsAt", event.startsAt);
    const ends = checkInstant(label, "endsAt", event.endsAt);
    if (ends < starts) problems.push(`${label}: ends before it starts`);
    checkPhoto(label, event.photo);
  }

  const announcementIds = new Set<string>();
  for (const announcement of announcements) {
    const label = `announcement "${announcement.id}"`;
    if (announcementIds.has(announcement.id)) problems.push(`${label}: id is used twice`);
    announcementIds.add(announcement.id);
    checkLength(label, "title", announcement.title, 80);
    checkLength(label, "body", announcement.body, 280);
    checkLength(label, "button label", announcement.cta?.label, 24);
    const publishes = checkInstant(label, "publishAt", announcement.publishAt);
    const expires = checkInstant(label, "expiresAt", announcement.expiresAt);
    if (!(expires > publishes) && !Number.isNaN(publishes) && !Number.isNaN(expires)) {
      problems.push(`${label}: expires before it publishes`);
    }
    checkPhoto(label, announcement.photo);
  }

  const leaderSlugs = new Set<string>();
  for (const leader of leaders) {
    const label = `leader "${leader.slug}"`;
    checkSlug(label, leader.slug, leaderSlugs);
    checkPhoto(label, leader.photo);
  }

  for (const [index, item] of faq.entries()) {
    if (!item.question.trim() || !item.answer.trim()) problems.push(`FAQ item ${index + 1}: needs a question and an answer`);
  }

  for (const [index, photo] of photos.entries()) checkPhoto(`photo ${index + 1}`, photo);

  for (const text of strings(content)) {
    if (CHAT_INVITES.some((pattern) => pattern.test(text))) {
      problems.push(`group chat invite link found: ${text.slice(0, 60)}`);
    }
  }

  return problems;
}

/** Every string anywhere inside a value. */
function* strings(value: unknown): Generator<string> {
  if (typeof value === "string") yield value;
  else if (Array.isArray(value)) for (const item of value) yield* strings(item);
  else if (value && typeof value === "object") for (const item of Object.values(value)) yield* strings(item);
}

/** The longest slug the database takes. */
export const SLUG_MAX = 80;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Cuts a slug to `max` characters, at the end of a word unless that would lose more than half of it. */
function trimTo(slug: string, max: number): string {
  if (slug.length <= max) return slug;
  const dash = slug.slice(0, max + 1).lastIndexOf("-");
  return slug.slice(0, dash > max / 2 ? dash : max).replace(/-+$/, "");
}

/** The slug with a suffix, shortened so the whole thing still fits. */
function withSuffix(slug: string, suffix: string): string {
  return `${trimTo(slug, SLUG_MAX - suffix.length - 1)}-${suffix}`;
}

/**
 * An event's address on the site, from its title: lowercase words and
 * dashes, like fall-retreat. A slug can't start with weekly-, since the
 * weekly nights' pages own those, and a title with nothing it can use
 * becomes event.
 */
export function slugify(title: string): string {
  const words = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const slug = trimTo(words, SLUG_MAX) || "event";
  return slug.startsWith("weekly-") ? trimTo(`event-${slug}`, SLUG_MAX) : slug;
}

/**
 * The slug, or, when another event has it, the slug with the day it
 * starts (worship-night-nov-14), then numbered from 2.
 */
export function uniqueSlug(slug: string, startDate: string, taken: ReadonlySet<string>): string {
  if (!taken.has(slug)) return slug;
  const [, month, day] = startDate.split("-").map(Number);
  const dated = `${MONTHS[month - 1]}-${day}`;
  let candidate = withSuffix(slug, dated);
  for (let count = 2; taken.has(candidate); count++) candidate = withSuffix(slug, `${dated}-${count}`);
  return candidate;
}

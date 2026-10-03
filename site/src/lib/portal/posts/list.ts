import type { Tables } from "@/lib/database.types";
import { addDays, formatTime, formatWeekdayDate, laDateOf, todayInLA } from "@/lib/dates";

export type PostRow = Pick<
  Tables<{ schema: "site" }, "posts">,
  | "id"
  | "title"
  | "body"
  | "tone"
  | "pinned"
  | "status"
  | "link_url"
  | "link_label"
  | "starts_at"
  | "ends_at"
  | "updated_at"
>;

/**
 * Where a heads-up stands. It's live while it's published and now is in
 * its window, the same rule the public site uses.
 */
export type PostState = "live" | "scheduled" | "draft" | "past";

export function postState(post: Pick<PostRow, "status" | "starts_at" | "ends_at">, now: Date): PostState {
  if (post.status === "draft") return "draft";
  const time = now.getTime();
  if (Date.parse(post.ends_at) <= time) return "past";
  return Date.parse(post.starts_at) > time ? "scheduled" : "live";
}

const byTime = (key: "starts_at" | "ends_at" | "updated_at", direction: 1 | -1) => (a: PostRow, b: PostRow) =>
  direction * (Date.parse(a[key]) - Date.parse(b[key])) || a.id.localeCompare(b.id);

/**
 * Heads-ups by where they stand. Live ones are in the site's order, so the
 * first is the one Home shows. Scheduled ones go soonest first, drafts by
 * last edit, and past ones by most recently ended.
 */
export function groupPosts(posts: PostRow[], now: Date): Record<PostState, PostRow[]> {
  const groups: Record<PostState, PostRow[]> = { live: [], scheduled: [], draft: [], past: [] };
  for (const post of posts) groups[postState(post, now)].push(post);
  groups.live.sort((a, b) => Number(b.pinned) - Number(a.pinned) || byTime("starts_at", -1)(a, b));
  groups.scheduled.sort(byTime("starts_at", 1));
  groups.draft.sort(byTime("updated_at", -1));
  groups.past.sort(byTime("ends_at", -1));
  return groups;
}

/** A nearby instant in words, like "today at 9:00 PM" or "Fri, Oct 9 at 9:00 AM". */
export function when(instant: Date | string, now: Date): string {
  const today = todayInLA(now);
  const date = laDateOf(instant);
  const day =
    date === today
      ? "today"
      : date === addDays(today, 1)
        ? "tomorrow"
        : date === addDays(today, -1)
          ? "yesterday"
          : formatWeekdayDate(date, today);
  return `${day} at ${formatTime(instant)}`;
}

/** The line under a heads-up in the list. */
export function whenLabel(post: PostRow, now: Date): string {
  switch (postState(post, now)) {
    case "live":
      return `Up until ${when(post.ends_at, now)}`;
    case "scheduled":
      return `Goes up ${when(post.starts_at, now)}`;
    case "past":
      return `Came down ${when(post.ends_at, now)}`;
    case "draft":
      return "Not published";
  }
}

/**
 * The composer's plain-words version of its start and end. A null start
 * means it goes up when it's published.
 */
export function windowSummary(start: Date | null, end: Date | null, now: Date): string {
  const comesDown = end ? when(end, now) : null;
  if (start && start <= now) {
    return `Up since ${when(start, now)}.${comesDown ? ` Comes down ${comesDown}.` : ""}`;
  }
  const goesUp = start ? `Goes up ${when(start, now)}` : "Goes up when you publish";
  return comesDown ? `${goesUp} and comes down ${comesDown}.` : `${goesUp}.`;
}

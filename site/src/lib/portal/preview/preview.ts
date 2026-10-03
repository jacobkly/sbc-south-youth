import type { ReactNode } from "react";
import { announcementFromRow, eventFromRow, type EventRow, type PostRow } from "@/lib/content/rows";
import type { Announcement, Photo, SiteEvent } from "@/lib/content/types";
import { checkEvent, type EventErrors, type EventValues } from "@/lib/portal/events/schema";
import { slugify } from "@/lib/portal/events/slug";
import { checkPost, type PostErrors, type PostValues } from "@/lib/portal/posts/schema";

/**
 * Unsaved editor values as the public site will show them. Each goes
 * through the same checks as saving, then the same row mapping the site
 * uses, so the preview can't drift from the real thing. A preview only
 * fails when the site couldn't show it at all, and then it says why.
 */

/** What the editor asks the preview to show. */
export type PreviewRequest =
  | { kind: "post"; values: PostValues }
  | { kind: "event"; values: EventValues; id: string | null; slug: string | null };

/** Each field an editor sends, and whether it's text or a switch. */
const POST_FIELDS: Record<keyof PostValues, "string" | "boolean"> = {
  title: "string",
  body: "string",
  linkUrl: "string",
  linkLabel: "string",
  tone: "string",
  pinned: "boolean",
  startsAt: "string",
  endsAt: "string",
};
const EVENT_FIELDS: Record<keyof EventValues, "string" | "boolean"> = {
  title: "string",
  summary: "string",
  body: "string",
  allDay: "boolean",
  startDate: "string",
  startTime: "string",
  endDate: "string",
  endTime: "string",
  locationName: "string",
  address: "string",
  costNote: "string",
  featured: "boolean",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Just the fields named, when each is the right kind, or null. */
function pick<Values>(raw: unknown, fields: Record<keyof Values & string, "string" | "boolean">): Values | null {
  if (!isRecord(raw)) return null;
  const values: Record<string, unknown> = {};
  for (const [field, kind] of Object.entries(fields)) {
    if (typeof raw[field] !== kind) return null;
    values[field] = raw[field];
  }
  return values as Values;
}

const isIdOrNull = (value: unknown): value is string | null => value === null || typeof value === "string";

/** The browser sends the request, so it's checked before anything reads it. Null when it's not one. */
export function readPreviewRequest(raw: unknown): PreviewRequest | null {
  if (!isRecord(raw)) return null;
  if (raw.kind === "post") {
    const values = pick<PostValues>(raw.values, POST_FIELDS);
    return values && { kind: "post", values };
  }
  if (raw.kind === "event" && isIdOrNull(raw.id) && isIdOrNull(raw.slug)) {
    const values = pick<EventValues>(raw.values, EVENT_FIELDS);
    return values && { kind: "event", values, id: raw.id, slug: raw.slug };
  }
  return null;
}

/** The rendered draft, or why it can't be shown. */
export type PreviewResult = { node: ReactNode } | { problem: string };

export type PostPreview = { ok: true; post: Announcement } | { ok: false; problem: string };
export type EventPreview = { ok: true; event: SiteEvent } | { ok: false; problem: string };

/** Stands in for an id until it's saved. */
const UNSAVED_ID = "preview";

const UNTITLED_POST = "Untitled heads-up";
const UNTITLED_EVENT = "Untitled event";

/** The cards never show when a heads-up is up, so any window that passes the checks will do. */
const ANY_WINDOW = { startsAt: "", endsAt: "2999-12-31T23:59" };

/** Any time passes, even one that's over, so a past event can be looked at too. */
const ANY_TIME = new Date(0);

const POST_ORDER: (keyof PostErrors)[] = ["title", "body", "tone", "linkUrl", "linkLabel"];
const EVENT_ORDER: (keyof EventErrors)[] = [
  "startDate",
  "startTime",
  "endDate",
  "endTime",
  "title",
  "locationName",
  "address",
  "costNote",
  "summary",
  "body",
];

function firstProblem<Key extends string>(errors: Partial<Record<Key, string>>, order: Key[]): string {
  const key = order.find((field) => errors[field]);
  return (key && errors[key]) || "Something here can't be shown yet.";
}

/** A heads-up as it shows on This Week and Home. It borrows the photo of an event it links to. */
export function previewPost(values: PostValues, events: SiteEvent[]): PostPreview {
  const title = values.title.trim() || UNTITLED_POST;
  const check = checkPost({ ...values, title, ...ANY_WINDOW }, { now: new Date() });
  if (!check.ok) return { ok: false, problem: firstProblem(check.errors, POST_ORDER) };

  const { post } = check;
  const row: PostRow = {
    id: UNSAVED_ID,
    title: post.title,
    body: post.body,
    link_url: post.link_url,
    link_label: post.link_label,
    tone: post.tone,
    pinned: post.pinned,
    starts_at: post.starts_at,
    ends_at: post.ends_at,
  };
  return { ok: true, post: announcementFromRow(row, events) };
}

/**
 * An event as it shows on This Week and its page. A draft's page follows
 * its title, and a published one's stays put.
 */
export function previewEvent(
  values: EventValues,
  { id, slug, photo }: { id: string | null; slug: string | null; photo?: Photo },
): EventPreview {
  const title = values.title.trim() || UNTITLED_EVENT;
  const check = checkEvent({ ...values, title }, { now: ANY_TIME });
  if (!check.ok) return { ok: false, problem: firstProblem(check.errors, EVENT_ORDER) };

  const { event } = check;
  const row: EventRow = {
    id: id ?? UNSAVED_ID,
    slug: slug ?? slugify(event.title),
    title: event.title,
    summary: event.summary,
    body: event.body,
    all_day: event.all_day,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    location_name: event.location_name,
    address: event.address,
    cost_note: event.cost_note,
    featured: event.featured,
    status: "published",
    cancel_reason: null,
    sequence: 0,
    updated_at: ANY_TIME.toISOString(),
  };
  return { ok: true, event: eventFromRow(row, photo) };
}

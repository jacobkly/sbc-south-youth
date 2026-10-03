import { postState, when, type PostRow, type PostState } from "./list";
import { presetEnd } from "./presets";
import { checkPost, toLocalInput, type PostErrors, type PostFields, type PostValues } from "./schema";

/**
 * The decisions behind each heads-up action, kept apart from the database
 * so each case can be tested. RLS, the column grants, and the triggers
 * still check everything again.
 */

/** Publish puts it up now or at its start. Draft keeps it off the site. */
export type SaveIntent = "publish" | "draft";

export type PostStatus = "draft" | "published";

/** The heads-up as it is now, read fresh before any change. */
export type ExistingPost = Pick<PostRow, "status" | "starts_at" | "ends_at">;

type Refuse = { kind: "refuse"; message: string };

export type SavePlan =
  | { kind: "invalid"; errors: PostErrors }
  | Refuse
  | { kind: "write"; row: PostFields & { status: PostStatus }; state: PostState };

const ALREADY_DOWN = "This heads-up has already come down. Post it again to put it back up.";

/**
 * What saving the composer writes. A blank start means now, except on a
 * heads-up that's already up, which always keeps its start so an edit
 * doesn't move it. One that's up can't slip back to a draft or to a later
 * start, since either would take it down without saying so, and one that's
 * come down stays as it was.
 */
export function planSave(values: unknown, intent: SaveIntent, existing: ExistingPost | null, now: Date): SavePlan {
  const state = existing && postState(existing, now);
  if (state === "past") return { kind: "refuse", message: ALREADY_DOWN };
  if (state === "live" && intent === "draft") {
    return { kind: "refuse", message: "It's up on the site now. Save your changes, or end it to take it down." };
  }

  const live = state === "live" && existing;
  const keepStart = live ? new Date(live.starts_at) : undefined;
  const fields = live && values && typeof values === "object" ? { ...values, startsAt: "" } : values;
  const check = checkPost(fields, { now, keepStart });
  if (!check.ok) return { kind: "invalid", errors: check.errors };

  const row = { ...check.post, status: intent === "publish" ? ("published" as const) : ("draft" as const) };
  return { kind: "write", row, state: postState(row, now) };
}

/** Ending a heads-up that's up brings it down now. */
export function planEnd(existing: ExistingPost, now: Date): Refuse | { kind: "write"; row: { ends_at: string } } {
  switch (postState(existing, now)) {
    case "live":
      return { kind: "write", row: { ends_at: now.toISOString() } };
    case "past":
      return { kind: "refuse", message: "It has already come down." };
    case "scheduled":
      return { kind: "refuse", message: "It isn't up yet. Move it to drafts instead." };
    case "draft":
      return { kind: "refuse", message: "It's a draft, so it isn't on the site." };
  }
}

/** A scheduled heads-up goes back to drafts, so it won't go up. */
export function planUnschedule(
  existing: ExistingPost,
  now: Date,
): Refuse | { kind: "write"; row: { status: "draft" } } {
  switch (postState(existing, now)) {
    case "scheduled":
      return { kind: "write", row: { status: "draft" } };
    case "live":
      return { kind: "refuse", message: "It's up on the site now. End it to take it down." };
    case "past":
      return { kind: "refuse", message: ALREADY_DOWN };
    case "draft":
      return { kind: "refuse", message: "It's already a draft." };
  }
}

/** Only a draft can be deleted. One that was ever published ends instead, so Activity keeps its story. */
export function planRemove(existing: ExistingPost, now: Date): Refuse | { kind: "delete" } {
  if (postState(existing, now) === "draft") return { kind: "delete" };
  return { kind: "refuse", message: "Only a draft can be deleted. End this one instead." };
}

/**
 * What saving did, in a sentence. `posting` is true unless the heads-up
 * was already up, so a change to one that's up says Saved, not Posted.
 */
export function savedMessage(row: ExistingPost, now: Date, posting: boolean): string {
  switch (postState(row, now)) {
    case "live":
      return `${posting ? "Posted" : "Saved"}. It's on the site now, until ${when(row.ends_at, now)}.`;
    case "scheduled":
      return `Scheduled. It goes up ${when(row.starts_at, now)}.`;
    case "draft":
      return "Saved as a draft. Nobody sees it yet.";
    case "past":
      return "Saved. It has already come down.";
  }
}

/** What the composer edits, when it's another heads-up's words. */
type PostContent = Pick<PostRow, "title" | "body" | "tone" | "pinned" | "link_url" | "link_label">;

function contentValues(post: PostContent): Omit<PostValues, "startsAt" | "endsAt"> {
  return {
    title: post.title,
    body: post.body,
    linkUrl: post.link_url ?? "",
    linkLabel: post.link_label ?? "",
    tone: post.tone,
    pinned: post.pinned,
  };
}

/** A new heads-up comes down at the end of the week unless it's told otherwise. */
function weekFrom(now: Date): string {
  return toLocalInput(presetEnd("week", now));
}

/**
 * The composer's starting values: blank for a new heads-up, or one as it
 * is. A blank start keeps a live one's start and means now for the rest,
 * so only a start that's still ahead shows. An end that's passed moves to
 * the end of this week, since it couldn't be saved anyway.
 */
export function formValues(post: (PostContent & ExistingPost) | null, now: Date): PostValues {
  if (!post) {
    const blank = { title: "", body: "", linkUrl: "", linkLabel: "", tone: "info", pinned: false };
    return { ...blank, startsAt: "", endsAt: weekFrom(now) };
  }
  const ahead = Date.parse(post.starts_at) > now.getTime();
  const ended = Date.parse(post.ends_at) <= now.getTime();
  return {
    ...contentValues(post),
    startsAt: ahead ? toLocalInput(post.starts_at) : "",
    endsAt: ended ? weekFrom(now) : toLocalInput(post.ends_at),
  };
}

/** Post it again: the same words, up now through the end of the week. */
export function againValues(post: PostContent, now: Date): PostValues {
  return { ...contentValues(post), startsAt: "", endsAt: weekFrom(now) };
}

"use server";

import { refresh, updateTag } from "next/cache";
import { requireRole } from "@/lib/portal/auth/require-role";
import { actionError } from "@/lib/portal/errors";
import { isId } from "@/lib/portal/photos/schema";
import { createClient } from "@/lib/supabase/server";
import { postState, type PostRow, type PostState } from "./list";
import { loadPost } from "./queries";
import { planEnd, planRemove, planSave, planUnschedule, savedMessage } from "./save";
import type { PostErrors, PostValues } from "./schema";

/**
 * Every heads-up change runs as the signed-in site editor, so RLS, the
 * column grants, and the triggers check it again. Each one refreshes the
 * public site's cached heads-ups, so Home shows the change on its next load.
 */

export type SaveResult =
  | { status: "invalid"; errors: PostErrors }
  | { status: "failed"; message: string }
  /** `photoProblem` says why the heads-up saved without the photo change. */
  | { status: "done"; id: string; state: PostState; message: string; photoProblem: string | null };

export type PostActionResult = { status: "failed"; message: string } | { status: "done"; message: string };

const REFUSAL = "Only site editors can change heads-ups.";
const GONE = "That heads-up isn't here anymore. Go back to Posts and try again.";

function failed(message: string): { status: "failed"; message: string } {
  return { status: "failed", message };
}

/**
 * Saves the composer: a new heads-up when `id` is null, or changes to one.
 * Publish puts it up now or at its start; draft keeps it off the site.
 * `photoId` is the photo it shows, or null for none.
 */
export async function savePost(
  id: string | null,
  values: PostValues,
  intent: "publish" | "draft",
  photoId: string | null,
): Promise<SaveResult> {
  const editor = await requireRole("site_editor", REFUSAL);
  if ("refused" in editor) return failed(editor.refused);
  if (intent !== "publish" && intent !== "draft") return failed("Pick Publish or Save draft.");
  if (photoId !== null && !isId(photoId)) return failed("The photo didn't come through right. Pick it again.");

  const existing = id === null ? null : await loadPost(id);
  if (id !== null && !existing) return failed(GONE);

  const now = new Date();
  const plan = planSave(values, intent, existing, now);
  if (plan.kind === "invalid") return { status: "invalid", errors: plan.errors };
  if (plan.kind === "refuse") return failed(plan.message);

  const fallback = "Couldn't save the heads-up. Check your connection and try again.";
  const table = await posts();
  const { data, error } = existing
    ? await table.update(plan.row).eq("id", existing.id).select("id").single()
    : await table.insert(plan.row).select("id").single();
  if (error) return failed(await actionError("Save a heads-up", error, fallback));

  // The heads-up is saved either way, so a photo that didn't go on is said alongside.
  const photoProblem = await placePhoto(data.id, photoId, existing !== null);
  updateTag("posts");
  updateTag("photos");
  const posting = !existing || postState(existing, now) !== "live";
  const message = savedMessage(plan.row, now, posting);
  return { status: "done", id: data.id, state: plan.state, message, photoProblem };
}

/**
 * Puts the chosen photo on the heads-up, moving the one it had back to the
 * library, or takes its photo off. A photo in a spot or on an event stays
 * there. Null when it worked, or else why it didn't.
 */
async function placePhoto(postId: string, photoId: string | null, existed: boolean): Promise<string | null> {
  if (photoId === null && !existed) return null;
  const photos = (await createClient()).schema("site").from("photos");
  const fallback = "The heads-up saved, but its photo didn't change. Check your connection and save again.";
  if (photoId === null) {
    const { error } = await photos.update({ post_id: null }).eq("post_id", postId);
    return error ? actionError("Take a photo off a heads-up", error, fallback) : null;
  }
  const { data, error } = await photos
    .update({ post_id: postId })
    .eq("id", photoId)
    .eq("status", "published")
    .is("spot", null)
    .is("event_id", null)
    .select("id");
  if (error) return actionError("Put a photo on a heads-up", error, fallback);
  if (data.length === 0) return "The heads-up saved, but that photo is on the site somewhere else now. Pick another.";
  return null;
}

/** Brings a heads-up that's up down now. */
export async function endPost(id: string): Promise<PostActionResult> {
  return change(id, async (post, now) => {
    const plan = planEnd(post, now);
    if (plan.kind === "refuse") return failed(plan.message);
    const { error } = await (await posts()).update(plan.row).eq("id", post.id);
    return outcome(
      "End a heads-up",
      error,
      "Couldn't end the heads-up.",
      "It's down now, and Home no longer shows it.",
    );
  });
}

/** Moves a scheduled heads-up back to drafts, so it won't go up. */
export async function unschedulePost(id: string): Promise<PostActionResult> {
  return change(id, async (post, now) => {
    const plan = planUnschedule(post, now);
    if (plan.kind === "refuse") return failed(plan.message);
    const { error } = await (await posts()).update(plan.row).eq("id", post.id);
    return outcome(
      "Unpublish a heads-up",
      error,
      "Couldn't move it to drafts.",
      "Moved to drafts. It won't go up unless you publish it.",
    );
  });
}

/**
 * Deletes a draft. The database refuses anything that was ever published.
 * Its page is gone after, so the form moves on to Posts instead of refreshing.
 */
export async function deletePost(id: string): Promise<PostActionResult> {
  return change(
    id,
    async (post, now) => {
      const plan = planRemove(post, now);
      if (plan.kind === "refuse") return failed(plan.message);
      const { error } = await (await posts()).delete().eq("id", post.id);
      return outcome("Delete a heads-up", error, "Couldn't delete the draft.", "Deleted the draft.");
    },
    { refreshPage: false },
  );
}

async function posts() {
  return (await createClient()).schema("site").from("posts");
}

async function outcome(
  source: string,
  error: { code?: string; message: string } | null,
  couldnt: string,
  message: string,
): Promise<PostActionResult> {
  if (error) return failed(await actionError(source, error, `${couldnt} Check your connection and try again.`));
  return { status: "done", message };
}

/**
 * The steps around a heads-up's own action: the role check and a fresh read
 * first, then, once it's written, refreshing the public site and the page.
 */
async function change(
  id: string,
  write: (post: PostRow, now: Date) => Promise<PostActionResult>,
  { refreshPage = true } = {},
): Promise<PostActionResult> {
  const editor = await requireRole("site_editor", REFUSAL);
  if ("refused" in editor) return failed(editor.refused);
  const post = await loadPost(id);
  if (!post) return failed(GONE);

  const result = await write(post, new Date());
  if (result.status === "done") {
    updateTag("posts");
    if (refreshPage) refresh();
  }
  return result;
}

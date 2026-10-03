"use server";

import { refresh, updateTag } from "next/cache";
import { requireRole } from "@/lib/portal/auth/require-role";
import { actionError } from "@/lib/portal/errors";
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
  | { status: "done"; id: string; state: PostState; message: string };

export type PostActionResult = { status: "failed"; message: string } | { status: "done"; message: string };

const REFUSAL = "Only site editors can change heads-ups.";
const GONE = "That heads-up isn't here anymore. Go back to Posts and try again.";

function failed(message: string): { status: "failed"; message: string } {
  return { status: "failed", message };
}

/**
 * Saves the composer: a new heads-up when `id` is null, or changes to one.
 * Publish puts it up now or at its start; draft keeps it off the site.
 */
export async function savePost(
  id: string | null,
  values: PostValues,
  intent: "publish" | "draft",
): Promise<SaveResult> {
  const editor = await requireRole("site_editor", REFUSAL);
  if ("refused" in editor) return failed(editor.refused);
  if (intent !== "publish" && intent !== "draft") return failed("Pick Publish or Save draft.");

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

  updateTag("posts");
  const posting = !existing || postState(existing, now) !== "live";
  return { status: "done", id: data.id, state: plan.state, message: savedMessage(plan.row, now, posting) };
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

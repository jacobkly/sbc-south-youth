"use server";

import { refresh, updateTag } from "next/cache";
import { requireRole } from "@/lib/portal/auth/require-role";
import { actionError } from "@/lib/portal/errors";
import { createClient } from "@/lib/supabase/server";
import { deleteFolder } from "./files";
import {
  checkNewPhoto,
  checkPhotoEdit,
  checkPhotoId,
  checkRemoval,
  type NewPhoto,
  type PhotoEdit,
  type PhotoRemoval,
  type RemovalResult,
} from "./schema";
import type { PhotoActionResult } from "./upload";

/**
 * Every photo change runs as the signed-in site editor, so RLS, the column
 * grants, and the triggers check it again.
 */

const REFUSAL = "Only site editors can change photos.";

/** The public pages' cache of placed photos. */
const PHOTOS_TAG = "photos";

function failed(message: string): PhotoActionResult {
  return { status: "failed", message };
}

/**
 * Adds a photo to the library once both of its files are up. The database
 * takes its byte size and type from the files, and refuses it until both
 * are there. It isn't on the site until it's placed.
 */
export async function addPhoto(photo: NewPhoto): Promise<PhotoActionResult> {
  const editor = await requireRole("site_editor", REFUSAL);
  if ("refused" in editor) return failed(editor.refused);

  const check = checkNewPhoto(photo);
  if (!check.ok) return failed(check.message);

  const supabase = await createClient();
  const { error } = await supabase.schema("site").from("photos").insert(check.row);
  if (error?.code === "23503") return failed("The photo didn't finish uploading. Try again.");
  if (error) {
    const fallback = "Couldn't add the photo. Check your connection and try again.";
    return failed(await actionError("Add a photo", error, fallback));
  }

  refresh();
  return { status: "done", message: "Added to the library." };
}

/**
 * Changes a photo's alt text and where it shows. Taking a spot or an
 * event's cover moves the photo that had it back to the library, in the
 * same write.
 */
export async function savePhoto(edit: PhotoEdit): Promise<PhotoActionResult> {
  const editor = await requireRole("site_editor", REFUSAL);
  if ("refused" in editor) return failed(editor.refused);

  const check = checkPhotoEdit(edit);
  if (!check.ok) return failed(check.message);

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("site")
    .from("photos")
    .update(check.changes)
    .eq("id", check.id)
    .select("id");
  if (error?.code === "23503") return failed("That event isn't there anymore. Reload the page and pick another.");
  if (error) {
    const fallback = "Couldn't save the photo. Check your connection and try again.";
    return failed(await actionError("Save a photo", error, fallback));
  }
  // RLS skips a photo that's already down.
  if (data.length === 0) return failed("That photo was taken down. Reload the page to see the library.");

  updateTag(PHOTOS_TAG);
  refresh();
  return { status: "done", message: "Saved." };
}

/**
 * Takes a photo down, keeping a tombstone of who, why, and the takedown
 * request it answers, then deletes its files. The page stops showing it
 * on its next load. When the files didn't delete, running this again
 * finds the photo already down and only deletes them.
 */
export async function removePhoto(removal: PhotoRemoval): Promise<RemovalResult> {
  const editor = await requireRole("site_editor", REFUSAL);
  if ("refused" in editor) return failed(editor.refused);

  const check = checkRemoval(removal);
  if (!check.ok) return failed(check.message);
  const { id, reason, messageId } = check.removal;

  const supabase = await createClient();
  const { error } = await supabase
    .schema("site")
    .rpc("remove_photo", { p_id: id, p_reason: reason, p_message_id: messageId ?? undefined });
  if (error && error.code !== "55000") {
    const fallback = "Couldn't take the photo down. Check your connection and try again.";
    return failed(await actionError("Take a photo down", error, fallback));
  }

  updateTag(PHOTOS_TAG);
  refresh();
  if (!(await deleteFolder(supabase, id))) {
    const message = "It's off the site, but its files didn't delete. Delete them under Taken down.";
    return { status: "files_left", message };
  }
  return { status: "done", message: "Taken down, and its files are deleted." };
}

/** Deletes the files of a photo that's down, when they didn't delete with it. */
export async function deletePhotoFiles(id: string): Promise<PhotoActionResult> {
  const editor = await requireRole("site_editor", REFUSAL);
  if ("refused" in editor) return failed(editor.refused);
  if (!checkPhotoId(id)) return failed("That didn't come through right. Reload the page and try again.");

  // The storage rules keep the files of a photo that's up.
  const supabase = await createClient();
  const deleted = await deleteFolder(supabase, id);
  refresh();
  return deleted
    ? { status: "done", message: "Its files are deleted." }
    : failed("Its files still didn't delete. Check your connection and try again.");
}

"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/portal/auth/require-role";
import { friendlyError } from "@/lib/portal/people/invite";
import { createClient } from "@/lib/supabase/server";
import { checkNewPhoto, type NewPhoto } from "./schema";
import type { PhotoActionResult } from "./upload";

/**
 * Every photo change runs as the signed-in site editor, so RLS, the column
 * grants, and the triggers check it again.
 */

const REFUSAL = "Only site editors can add photos.";

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
  if (error) return failed(friendlyError(error, "Couldn't add the photo. Check your connection and try again."));

  refresh();
  return { status: "done", message: "Added to the library." };
}

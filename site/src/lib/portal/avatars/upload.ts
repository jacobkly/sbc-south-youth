import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { ImageFormat } from "@/lib/portal/images/canvas";
import type { ProcessedAvatar } from "./compress";

export const AVATARS_BUCKET = "avatars";

/** Where a picture lives in the bucket. The database checks this exact format. */
export function avatarPath(userId: string, pictureId: string, mimeType: ImageFormat): string {
  return `${userId}/${pictureId}.${mimeType === "image/webp" ? "webp" : "jpg"}`;
}

/** Points the user at `path`, or clears their picture. RLS skips someone else's row, so this checks one came back. */
async function setAvatarPath(supabase: SupabaseClient<Database>, userId: string, path: string | null): Promise<boolean> {
  const { data, error } = await supabase.from("users").update({ avatar_path: path }).eq("id", userId).select("id");
  return !error && data.length > 0;
}

/**
 * Deletes every file in the user's folder except `keep`. Best effort: a file
 * left behind is tiny, and the next save or remove tries again.
 */
async function deleteOtherFiles(supabase: SupabaseClient<Database>, userId: string, keep: string | null) {
  try {
    const bucket = supabase.storage.from(AVATARS_BUCKET);
    const { data, error } = await bucket.list(userId);
    if (error) return;
    const paths = data.map((file) => `${userId}/${file.name}`).filter((path) => path !== keep);
    if (paths.length > 0) await bucket.remove(paths);
  } catch {
    // A dropped connection throws instead of returning an error.
  }
}

/**
 * Uploads a new picture, points the user at it, then deletes their old ones.
 * Every picture gets a new name, so no browser shows a cached old one. If
 * the user can't be pointed at it, the upload is deleted again. Returns the
 * new path.
 */
export async function saveAvatar(
  supabase: SupabaseClient<Database>,
  userId: string,
  picture: ProcessedAvatar,
): Promise<string> {
  const path = avatarPath(userId, crypto.randomUUID(), picture.mimeType);
  const bucket = supabase.storage.from(AVATARS_BUCKET);

  const { error: uploadError } = await bucket.upload(path, picture.blob, {
    contentType: picture.mimeType,
    upsert: false,
  });
  if (uploadError) throw new Error("Couldn't upload your picture.");

  if (!(await setAvatarPath(supabase, userId, path))) {
    try {
      await bucket.remove([path]);
    } catch {
      // The save still failed; the next save cleans up the folder anyway.
    }
    throw new Error("Couldn't save your picture.");
  }

  await deleteOtherFiles(supabase, userId, path);
  return path;
}

/** Clears the user's picture, then deletes their files, so the app never points at a missing file. */
export async function removeAvatar(supabase: SupabaseClient<Database>, userId: string): Promise<void> {
  if (!(await setAvatarPath(supabase, userId, null))) throw new Error("Couldn't remove your picture.");
  await deleteOtherFiles(supabase, userId, null);
}

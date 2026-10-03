import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { photoPath, PHOTOS_BUCKET, type PhotoSize, type PhotoType } from "@/lib/photo-files";

const SIZES: PhotoSize[] = ["lg", "sm"];
const TYPES: PhotoType[] = ["image/webp", "image/jpeg"];

/**
 * Deletes a photo's files, which the storage rules allow once it's down.
 * Storage skips a file it may not delete without saying so, so this then
 * checks the folder is empty. It tries both types, so it needs only the
 * id. Returns whether the files are gone.
 */
export async function deleteFolder(supabase: SupabaseClient<Database>, id: string): Promise<boolean> {
  const bucket = supabase.storage.from(PHOTOS_BUCKET);
  try {
    const removed = await bucket.remove(TYPES.flatMap((type) => SIZES.map((size) => photoPath(id, size, type))));
    if (removed.error) return false;
    const left = await bucket.list(id);
    return !left.error && left.data.length === 0;
  } catch {
    // A dropped connection throws instead of returning an error.
    return false;
  }
}

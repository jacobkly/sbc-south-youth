import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { photoPath, PHOTOS_BUCKET, type PhotoSize } from "@/lib/photo-files";
import type { ProcessedPhoto } from "./compress";
import type { NewPhoto } from "./schema";

export type PhotoActionResult = { status: "failed"; message: string } | { status: "done"; message: string };

/** The server action that adds a photo's row once its files are up. */
export type AddPhoto = (photo: NewPhoto) => Promise<PhotoActionResult>;

export type UploadResult = { status: "failed"; message: string } | { status: "done"; id: string; message: string };

const SIZES: PhotoSize[] = ["lg", "sm"];

/**
 * A file never changes once it's up, but an hour keeps a photo that comes
 * down from loading out of caches for long after.
 */
const CACHE_SECONDS = "3600";

function failed(message: string): UploadResult {
  return { status: "failed", message };
}

/**
 * Uploads both sizes of a photo into a new random folder, then adds its row
 * as the signed-in site editor. If any step fails, the files are deleted
 * again, which the storage rules allow while the photo has no row.
 */
export async function uploadPhoto(
  supabase: SupabaseClient<Database>,
  photo: ProcessedPhoto,
  alt: string,
  addPhoto: AddPhoto,
): Promise<UploadResult> {
  // The upload checks storage again, so a failed check only skips the early answer.
  const { data: open } = await supabase.schema("site").rpc("photo_uploads_open");
  if (open === false) {
    return failed("Storage is nearly full, so new photos can't go up. Take down photos the site no longer uses first.");
  }

  const id = crypto.randomUUID();
  const paths = SIZES.map((size) => photoPath(id, size, photo.mimeType));
  const bucket = supabase.storage.from(PHOTOS_BUCKET);

  let result: PhotoActionResult;
  try {
    const uploads = await Promise.all(
      SIZES.map((size, index) =>
        bucket.upload(paths[index], photo.files[size], {
          contentType: photo.mimeType,
          cacheControl: CACHE_SECONDS,
          upsert: false,
        }),
      ),
    );
    if (uploads.some(({ error }) => error)) throw new Error("upload");
  } catch {
    await removeFiles(bucket, paths);
    return failed("Couldn't upload the photo. Check your connection and try again.");
  }

  try {
    result = await addPhoto({ id, alt, width: photo.width, height: photo.height });
  } catch {
    result = { status: "failed", message: "Couldn't add the photo. Check your connection and try again." };
  }

  if (result.status === "failed") {
    await removeFiles(bucket, paths);
    return result;
  }
  return { status: "done", id, message: result.message };
}

/** Best effort: files left without a row never show anywhere, and they're small. */
async function removeFiles(bucket: ReturnType<SupabaseClient<Database>["storage"]["from"]>, paths: string[]) {
  try {
    await bucket.remove(paths);
  } catch {
    // A dropped connection throws instead of returning an error.
  }
}

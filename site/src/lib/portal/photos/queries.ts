import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PhotoType } from "@/lib/photo-files";

/**
 * What the Photos screen reads, as the signed-in site editor. RLS lets
 * only site editors list photos, so anyone else gets nothing.
 */

export type LibraryPhoto = {
  id: string;
  alt: string;
  width: number;
  height: number;
  mimeType: PhotoType;
  createdAt: string;
};

/** Photos that are up, newest first. Ones that came down stay as tombstones, out of the library. */
export async function loadPhotos(): Promise<LibraryPhoto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("site")
    .from("photos")
    .select("id, alt, width, height, mime_type, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((photo) => ({
    id: photo.id,
    alt: photo.alt,
    width: photo.width,
    height: photo.height,
    // The database allows only these two.
    mimeType: photo.mime_type as PhotoType,
    createdAt: photo.created_at,
  }));
}

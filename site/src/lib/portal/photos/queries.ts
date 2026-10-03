import "server-only";
import { photoFromRow } from "@/lib/content/photos";
import type { Photo } from "@/lib/content/types";
import type { Enums } from "@/lib/database.types";
import type { PhotoType } from "@/lib/photo-files";
import { supabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { isId } from "./schema";

/**
 * What the Photos screen reads, as the signed-in person. RLS lets only
 * site editors list photos, and the Messages role see the ones taken down
 * for a request, so anyone else gets nothing.
 */

export type LibraryPhoto = {
  id: string;
  alt: string;
  width: number;
  height: number;
  mimeType: PhotoType;
  /** Where it shows: a spot's code name, or an event's cover. Neither when it's only in the library. */
  spot: string | null;
  eventId: string | null;
  uploadedBy: string | null;
  createdAt: string;
};

/** Photos that are up, newest first. Ones that came down stay as tombstones, out of the library. */
export async function loadPhotos(): Promise<LibraryPhoto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("site")
    .from("photos")
    .select("id, alt, width, height, mime_type, spot, event_id, uploaded_by, created_at")
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
    spot: photo.spot,
    eventId: photo.event_id,
    uploadedBy: photo.uploaded_by,
    createdAt: photo.created_at,
  }));
}

/**
 * An event's cover the way its page shows it, for the editors' preview.
 * The public read skips drafts, so this one reads as the editor.
 */
export async function loadEventCover(eventId: string): Promise<Photo | undefined> {
  if (!isId(eventId)) return undefined;
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("site")
    .from("photos")
    .select("id, spot, event_id, alt, width, height, mime_type")
    .eq("status", "published")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) throw error;
  return data ? photoFromRow(data, supabaseEnv().url) : undefined;
}

export type CoverEvent = { id: string; title: string; startsAt: string; status: Enums<{ schema: "site" }, "event_status"> };

/**
 * Events a photo can be the cover of: drafts and ones that haven't ended,
 * soonest first, and any that already have a cover, so it still shows.
 */
export async function loadCoverEvents(now: Date, coverIds: readonly string[]): Promise<CoverEvent[]> {
  const supabase = await createClient();
  const filters = [`status.eq.draft`, `ends_at.gt.${now.toISOString()}`];
  if (coverIds.length > 0) filters.push(`id.in.(${coverIds.join(",")})`);
  const { data, error } = await supabase
    .schema("site")
    .from("events")
    .select("id, title, starts_at, status")
    .or(filters.join(","))
    .order("starts_at");
  if (error) throw error;
  return data.map((event) => ({ id: event.id, title: event.title, startsAt: event.starts_at, status: event.status }));
}

export type TakedownRequest = { id: string; name: string; createdAt: string };

/**
 * Photo takedown requests that are still open, oldest first, to link one
 * to the photo it asked about. Only the Messages role reads messages.
 */
export async function loadOpenTakedowns(): Promise<TakedownRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("site")
    .from("messages")
    .select("id, name, created_at")
    .eq("kind", "takedown")
    .eq("env", "production")
    .in("status", ["new", "in_progress"])
    .order("created_at")
    .limit(50);
  if (error) throw error;
  return data.map((message) => ({ id: message.id, name: message.name, createdAt: message.created_at }));
}

export type TakenDownPhoto = {
  id: string;
  alt: string;
  removedAt: string;
  removedBy: string | null;
  reason: string;
  messageId: string | null;
};

const TOMBSTONE = "id, alt, removed_at, removed_by, removed_reason, takedown_message_id";

type TombstoneRow = {
  id: string;
  alt: string;
  removed_at: string | null;
  removed_by: string | null;
  removed_reason: string | null;
  takedown_message_id: string | null;
};

function tombstone(row: TombstoneRow): TakenDownPhoto {
  return {
    id: row.id,
    alt: row.alt,
    // A photo that's down always has both.
    removedAt: row.removed_at ?? "",
    removedBy: row.removed_by,
    reason: row.removed_reason ?? "",
    messageId: row.takedown_message_id,
  };
}

/** How many tombstones the Photos screen lists. Older ones are still in Activity. */
const TAKEN_DOWN_LIMIT = 20;

/**
 * The photos taken down most recently, and which of all of them still
 * have files to delete.
 */
export async function loadTakenDown(): Promise<{ photos: TakenDownPhoto[]; filesLeft: Set<string> }> {
  const supabase = await createClient();
  const [photos, left] = await Promise.all([
    supabase
      .schema("site")
      .from("photos")
      .select(TOMBSTONE)
      .eq("status", "removed")
      .order("removed_at", { ascending: false })
      .limit(TAKEN_DOWN_LIMIT),
    supabase.schema("site").rpc("photos_with_files_left"),
  ]);
  if (photos.error) throw photos.error;
  if (left.error) throw left.error;
  // One with files left goes on the list even when it's older than the rest.
  const listed = new Set(photos.data.map(({ id }) => id));
  const older = left.data.filter(({ id }) => !listed.has(id)).map(({ id }) => id);
  const extra = older.length
    ? await supabase.schema("site").from("photos").select(TOMBSTONE).in("id", older)
    : { data: [], error: null };
  if (extra.error) throw extra.error;
  return {
    photos: [...photos.data, ...extra.data].map(tombstone),
    filesLeft: new Set(left.data.map(({ id }) => id)),
  };
}

/** The photos taken down for one takedown request, which the Messages role can see. */
export async function loadTakedownPhotos(messageId: string): Promise<TakenDownPhoto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("site")
    .from("photos")
    .select(TOMBSTONE)
    .eq("takedown_message_id", messageId)
    .order("removed_at", { ascending: false });
  if (error) throw error;
  return data.map(tombstone);
}

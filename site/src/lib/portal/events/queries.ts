import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { EventRow } from "./list";

/**
 * What the Events screens read, as the signed-in site editor. RLS decides
 * what comes back, so anyone else gets nothing.
 */

// One template literal, not two strings added together, so its type still names the columns.
const COLUMNS = `id, slug, title, summary, body, starts_at, ends_at, all_day, location_name, address, cost_note,
  featured, status, cancel_reason, updated_at`;

/** How many past events the list shows. Older ones are still in Activity. */
export const PAST_LIMIT = 20;

/** Drafts and events that haven't ended, and the most recent ones that have. */
export async function loadEvents(now: Date): Promise<{ current: EventRow[]; past: EventRow[] }> {
  const supabase = await createClient();
  const at = now.toISOString();
  const [current, past] = await Promise.all([
    supabase.schema("site").from("events").select(COLUMNS).or(`status.eq.draft,ends_at.gt.${at}`),
    supabase
      .schema("site")
      .from("events")
      .select(COLUMNS)
      .neq("status", "draft")
      .lte("ends_at", at)
      .order("ends_at", { ascending: false })
      .limit(PAST_LIMIT),
  ]);
  if (current.error) throw current.error;
  if (past.error) throw past.error;
  return { current: current.data, past: past.data };
}

/** One event, or null when it isn't there or isn't theirs to see. */
export async function loadEvent(id: unknown): Promise<EventRow | null> {
  if (typeof id !== "string" || !z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("site")
    .from("events")
    .select(COLUMNS)
    .eq("id", id.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * The slugs other events have that start like this one, so a new slug can
 * step around them. Slugs are only letters, digits, and dashes, so nothing
 * in `prefix` reads as a wildcard.
 */
export async function takenSlugs(prefix: string, exceptId: string | null): Promise<Set<string>> {
  const supabase = await createClient();
  let query = supabase.schema("site").from("events").select("slug").like("slug", `${prefix}%`);
  if (exceptId) query = query.neq("id", exceptId);
  const { data, error } = await query;
  if (error) throw error;
  return new Set(data.map(({ slug }) => slug));
}

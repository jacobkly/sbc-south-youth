import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { PostRow } from "./list";

/**
 * What the Posts screens read, as the signed-in site editor. RLS decides
 * what comes back, so anyone else gets nothing.
 */

const COLUMNS = "id, title, body, tone, pinned, status, link_url, link_label, starts_at, ends_at, updated_at";

/** How many heads-ups that have come down the list shows. Older ones are still in Activity. */
export const PAST_LIMIT = 20;

/**
 * Drafts and heads-ups that haven't come down, and the most recent ones
 * that have.
 */
export async function loadPosts(now: Date): Promise<{ current: PostRow[]; past: PostRow[] }> {
  const supabase = await createClient();
  const at = now.toISOString();
  const [current, past] = await Promise.all([
    supabase.schema("site").from("posts").select(COLUMNS).or(`status.eq.draft,ends_at.gt.${at}`),
    supabase
      .schema("site")
      .from("posts")
      .select(COLUMNS)
      .eq("status", "published")
      .lte("ends_at", at)
      .order("ends_at", { ascending: false })
      .limit(PAST_LIMIT),
  ]);
  if (current.error) throw current.error;
  if (past.error) throw past.error;
  return { current: current.data, past: past.data };
}

/** One heads-up, or null when it isn't there or isn't theirs to see. */
export async function loadPost(id: unknown): Promise<PostRow | null> {
  if (typeof id !== "string" || !z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("site")
    .from("posts")
    .select(COLUMNS)
    .eq("id", id.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

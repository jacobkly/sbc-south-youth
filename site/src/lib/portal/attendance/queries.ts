import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Headcount } from "./headcount";

/**
 * What the Attendance screen reads, as the signed-in person. RLS lets only
 * the Attendance role, finance viewers, and owners read headcounts, so
 * anyone else gets nothing.
 */

const COLUMNS = "id, night, total, note, combined";

/** Every night's count, newest first, or only the newest few. A year of Fridays is about 50. */
export async function loadHeadcounts(limit?: number): Promise<Headcount[]> {
  const supabase = await createClient();
  const query = supabase.from("headcounts").select(COLUMNS).order("night", { ascending: false });
  const { data, error } = await (limit === undefined ? query : query.limit(limit));
  if (error) throw error;
  return data;
}

/** One night's count, or null when it isn't there or isn't theirs to see. */
export async function loadHeadcount(id: unknown): Promise<Headcount | null> {
  if (typeof id !== "string" || !z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("headcounts").select(COLUMNS).eq("id", id.toLowerCase()).maybeSingle();
  if (error) throw error;
  return data;
}

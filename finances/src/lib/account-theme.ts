import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { parseSavedTheme, type Theme } from "@/lib/theme";

/** Saves run one at a time, so the account ends up with the last pick. */
let queue: Promise<unknown> = Promise.resolve();
let pending = 0;
let started = 0;

/**
 * Saves the theme on the user's row. Rejects when it didn't save, but this
 * device keeps it either way.
 */
export function saveAccountTheme(supabase: SupabaseClient<Database>, userId: string, theme: Theme): Promise<void> {
  pending += 1;
  started += 1;
  const save = queue
    .then(async () => {
      const { data, error } = await supabase.from("users").update({ theme }).eq("id", userId).select("id");
      // RLS skips someone else's row, or a deactivated user's, so check one came back.
      if (error || data.length === 0) throw new Error("The theme didn't save to the account.");
    })
    .finally(() => {
      pending -= 1;
    });
  queue = save.catch(() => {});
  return save;
}

/**
 * The theme saved on the user's row. Null when there's none, it can't be
 * read, or this device saved a newer one while it loaded.
 */
export async function fetchAccountTheme(supabase: SupabaseClient<Database>, userId: string): Promise<Theme | null> {
  const before = started;
  try {
    const { data } = await supabase.from("users").select("theme").eq("id", userId).maybeSingle();
    return pending === 0 && started === before ? parseSavedTheme(data?.theme) : null;
  } catch {
    // A dropped connection throws instead of returning an error.
    return null;
  }
}

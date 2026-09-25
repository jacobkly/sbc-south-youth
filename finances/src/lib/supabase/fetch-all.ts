import type { PostgrestError } from "@supabase/supabase-js";

// Supabase caps the rows one request returns, at 1,000 unless the project changes it.
const PAGE_SIZE = 1000;

/**
 * Loads every row of a query, a page at a time. Use it for totals, where
 * rows past the cap would silently make a sum wrong. The query needs a
 * stable order, like `.order("id")`, so pages don't overlap.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  while (true) {
    const { data, error } = await page(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw error;
    // Only an empty page means the end. A short one might just be a lower cap.
    if (!data || data.length === 0) return rows;
    rows.push(...data);
  }
}

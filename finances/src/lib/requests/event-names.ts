/**
 * Distinct event names from requests, newest first. Names that differ only in
 * case or spacing count once, using the newest spelling.
 */
export function recentEventNames(rows: { event_name: string | null }[], limit = 20): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const { event_name } of rows) {
    const name = event_name?.trim();
    if (!name) continue;
    const key = name.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length === limit) break;
  }
  return names;
}

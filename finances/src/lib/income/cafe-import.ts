import type { IsoDate } from "@/lib/dates";
import type { CafeLines, CafeWeek } from "./cafe";
import type { ParsedSalesSummary } from "./square";
import { FIRST_WEEK_ENDING, latestWeekEnding } from "./weeks";

/**
 * One week read from a file picked for import, with the week the person
 * picked when the file has no dates. A file by day gives one of these per
 * week. Its key is picked once, and a new week saves with it as its id, so
 * importing again after a dropped connection can't add it twice.
 */
export type CafeImportFile = { key: string; name: string; parsed: ParsedSalesSummary; picked: IsoDate | null };

/** What importing a file would do. */
export type CafeImportRow = Pick<CafeImportFile, "key" | "name"> &
  (
    | { status: "new"; week_ending: IsoDate; lines: CafeLines }
    | { status: "existing"; week_ending: IsoDate; lines: CafeLines; /** The saved week's id. */ id: string }
    | { status: "needs_week"; lines: CafeLines }
    | { status: "error"; error: string }
  );

/** Sorts problems first, then files waiting for a week, then weeks newest first. */
export function byImportOrder(a: CafeImportFile, b: CafeImportFile): number {
  const rank = (file: CafeImportFile) => (!file.parsed.ok ? 0 : file.parsed.week_ending ? 2 : 1);
  const week = (file: CafeImportFile) => (file.parsed.ok ? (file.parsed.week_ending ?? "") : "");
  return rank(a) - rank(b) || week(b).localeCompare(week(a));
}

/**
 * What each file would do, in the order picked. A week already entered is
 * marked with its id, so the person can choose to replace it. Two files for
 * one week are both turned away, since there's no telling which is right.
 */
export function planCafeImport(
  files: readonly CafeImportFile[],
  saved: readonly Pick<CafeWeek, "id" | "week_ending">[],
  today: IsoDate,
): CafeImportRow[] {
  const latest = latestWeekEnding(today);
  const weekOf = (file: CafeImportFile) => (file.parsed.ok ? (file.parsed.week_ending ?? file.picked) : null);

  const counts = new Map<IsoDate, number>();
  for (const file of files) {
    const week = weekOf(file);
    if (week) counts.set(week, (counts.get(week) ?? 0) + 1);
  }
  const ids = new Map(saved.map((week) => [week.week_ending, week.id]));

  return files.map((file): CafeImportRow => {
    const { key, name, parsed } = file;
    if (!parsed.ok) return { key, name, status: "error", error: parsed.error };

    const week_ending = weekOf(file);
    if (!week_ending) return { key, name, status: "needs_week", lines: parsed.lines };
    if (week_ending > latest) return { key, name, status: "error", error: "This file's week hasn't started yet." };
    if (week_ending < FIRST_WEEK_ENDING) return { key, name, status: "error", error: "Pick a week in 2000 or later." };
    if ((counts.get(week_ending) ?? 0) > 1) {
      return { key, name, status: "error", error: "Two files are for this week. Leave one of them out." };
    }

    const id = ids.get(week_ending);
    return id
      ? { key, name, status: "existing", week_ending, lines: parsed.lines, id }
      : { key, name, status: "new", week_ending, lines: parsed.lines };
  });
}

/**
 * The rows to save: each new week, and each week already entered that the
 * person chose to replace, by its Sunday. A replaced week keeps its note.
 */
export function cafeImportWrites(rows: readonly CafeImportRow[], replace: ReadonlySet<IsoDate>) {
  const inserts: (CafeLines & { id: string; week_ending: IsoDate; source: "square" })[] = [];
  const updates: (CafeLines & { id: string; source: "square" })[] = [];
  for (const row of rows) {
    if (row.status === "new") inserts.push({ id: row.key, week_ending: row.week_ending, ...row.lines, source: "square" });
    if (row.status === "existing" && replace.has(row.week_ending)) {
      updates.push({ id: row.id, ...row.lines, source: "square" });
    }
  }
  return { inserts, updates };
}

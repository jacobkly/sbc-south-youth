import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { IsoDate } from "@/lib/dates";
import { amountProblem, dateProblem, MAX_IMPORT_ROWS, parseTable, type ImportProblem } from "@/lib/import/parse";
import { fetchAll } from "@/lib/supabase/fetch-all";

/** The tithe sheet's columns, in the order they're read when there's no header row. */
const COLUMNS = ["date", "amount"] as const;

type TitheColumn = (typeof COLUMNS)[number];

const COLUMN_LABELS: Record<TitheColumn, string> = { date: "Date", amount: "Amount" };

/** Header names each column goes by. */
const HEADER_NAMES: Record<TitheColumn, readonly string[]> = {
  date: ["date"],
  amount: ["amount", "tithe"],
};

/**
 * A tithe checked and ready to import. `line` is its row number in the
 * spreadsheet. A tithe has no name, so the sheet's other columns are never
 * read.
 */
export type TitheRow = { line: number; date: IsoDate; amount_cents: number };

export type ParsedTithes =
  | { ok: true; rows: TitheRow[]; problems: ImportProblem[]; hasHeader: boolean }
  | { ok: false; error: string };

/** Finds each column by its header, or null when the first row isn't a header. */
function headerColumns(first: string[]): Partial<Record<TitheColumn, number>> | null {
  const cells = first.map((cell) => cell.trim().toLowerCase());
  const columns: Partial<Record<TitheColumn, number>> = {};
  for (const column of COLUMNS) {
    const index = cells.findIndex((cell) => HEADER_NAMES[column].includes(cell));
    if (index >= 0) columns[column] = index;
  }
  // Neither name could be a date or an amount, so one is enough.
  return Object.keys(columns).length > 0 ? columns : null;
}

/**
 * Reads and checks every row of a spreadsheet of tithes with the columns
 * Date and Amount. With a header row, the columns can be in any order and
 * extra ones are ignored. Without one, they're read in that order. Blank
 * rows are skipped. Each row either comes back ready to import or with
 * everything wrong with it.
 */
export function parseTitheImport(text: string, today: IsoDate): ParsedTithes {
  const table = parseTable(text);
  const header = table.length > 0 ? headerColumns(table[0]) : null;

  if (header) {
    const missing = COLUMNS.filter((column) => header[column] === undefined);
    if (missing.length > 0) {
      return { ok: false, error: `The header row is missing a column: ${COLUMN_LABELS[missing[0]]}.` };
    }
  }

  const columns: Partial<Record<TitheColumn, number>> = header ?? { date: 0, amount: 1 };
  const rows: TitheRow[] = [];
  const problems: ImportProblem[] = [];

  table.forEach((cells, index) => {
    if (header && index === 0) return;
    if (cells.every((cell) => cell.trim() === "")) return;

    const cell = (column: TitheColumn) => {
      const at = columns[column];
      return at === undefined ? "" : (cells[at] ?? "");
    };
    const line = index + 1;
    const { date, message: dateMessage } = dateProblem(cell("date"), today);
    const { cents, message: amountMessage } = amountProblem(cell("amount"));

    if (!date || cents === undefined) {
      problems.push({ line, messages: [dateMessage, amountMessage].filter((message) => message !== undefined) });
      return;
    }
    rows.push({ line, date, amount_cents: cents });
  });

  const count = rows.length + problems.length;
  if (count === 0) return { ok: false, error: "There are no rows to import." };
  if (count > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      error: `That's ${count.toLocaleString("en-US")} rows. Import at most ${MAX_IMPORT_ROWS.toLocaleString("en-US")} at a time.`,
    };
  }

  return { ok: true, rows, problems, hasHeader: header !== null };
}

export type ExistingTithe = { received_on: IsoDate; amount_cents: number };

/**
 * Line numbers of rows that match a tithe already entered on the same date
 * for the same amount, so importing the same sheet twice doesn't count it
 * twice. Each tithe already entered matches at most one row, since two equal
 * gifts on one day are normal.
 */
export function matchingTithes(rows: readonly TitheRow[], existing: readonly ExistingTithe[]): Set<number> {
  const unmatched = new Map<string, number>();
  for (const tithe of existing) {
    const key = `${tithe.received_on}|${tithe.amount_cents}`;
    unmatched.set(key, (unmatched.get(key) ?? 0) + 1);
  }

  const matches = new Set<number>();
  for (const row of rows) {
    const key = `${row.date}|${row.amount_cents}`;
    const left = unmatched.get(key) ?? 0;
    if (left > 0) {
      matches.add(row.line);
      unmatched.set(key, left - 1);
    }
  }
  return matches;
}

export type TitheMonthTotal = { month: string; count: number; total: number };

/** How many tithes and how much each month, oldest first, to check against the spreadsheet. */
export function titheMonthTotals(rows: readonly TitheRow[]): TitheMonthTotal[] {
  const months = new Map<string, TitheMonthTotal>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    const total = months.get(month) ?? { month, count: 0, total: 0 };
    total.count += 1;
    total.total += row.amount_cents;
    months.set(month, total);
  }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** The tithes already entered in the import's date range. Events don't count. Throws on failure. */
export function loadExistingTithes(
  supabase: SupabaseClient<Database>,
  rows: readonly TitheRow[],
): Promise<ExistingTithe[]> {
  const dates = rows.map((row) => row.date).sort();
  if (dates.length === 0) return Promise.resolve([]);
  return fetchAll((from, to) =>
    supabase
      .from("youth_income")
      .select("received_on, amount_cents")
      .eq("kind", "tithe")
      .gte("received_on", dates[0])
      .lte("received_on", dates[dates.length - 1])
      .order("id")
      .range(from, to),
  );
}

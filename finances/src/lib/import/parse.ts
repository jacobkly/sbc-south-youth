import { isIsoDate, type IsoDate } from "@/lib/dates";
import { formatCents, parseAmountToCents } from "@/lib/money";
import { MAX_REQUEST_CENTS, MIN_PURCHASE_DATE, type RequestType } from "@/lib/requests/schema";

/** The spreadsheet's columns, in the order they're read when there's no header row. */
export const IMPORT_COLUMNS = ["date", "name", "amount", "type", "notes"] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

export const IMPORT_COLUMN_LABELS: Record<ImportColumn, string> = {
  date: "Date",
  name: "Name",
  amount: "Amount",
  type: "Type",
  notes: "Notes",
};

/** Header names each column goes by. Notes can be left out. */
const HEADER_NAMES: Record<ImportColumn, readonly string[]> = {
  date: ["date"],
  name: ["name", "payee"],
  amount: ["amount"],
  type: ["type"],
  notes: ["notes", "note"],
};

const REQUIRED_COLUMNS = ["date", "name", "amount", "type"] as const satisfies readonly ImportColumn[];

// Limits match import_paid_requests and the payees and requests table checks.
export const MAX_IMPORT_ROWS = 2000;
const MAX_NAME = 100;
const MAX_NOTES = 1000;

/** A row checked and ready to import. `line` is its row number in the spreadsheet. */
export type ImportRow = {
  line: number;
  date: IsoDate;
  name: string;
  amount_cents: number;
  type: RequestType;
  notes: string;
};

/** What's wrong with one spreadsheet row. */
export type ImportProblem = { line: number; messages: string[] };

export type ParsedImport =
  | { ok: true; rows: ImportRow[]; problems: ImportProblem[]; hasHeader: boolean }
  | { ok: false; error: string };

/**
 * Splits pasted cells or a CSV file into rows of fields. Text copied from a
 * spreadsheet is tab-separated, and a CSV is comma-separated, so the first
 * line picks the delimiter. Quoted fields can hold delimiters, quotes, and
 * line breaks.
 */
export function parseTable(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/).find((line) => line.trim() !== "") ?? "";
  const delimiter = firstLine.includes("\t") ? "\t" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (source[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (char === '"' && field === "") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Trims a name and collapses runs of spaces, the way the import stores it. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Names that differ only in case and spacing belong to the same payee. */
export function nameKey(name: string): string {
  return normalizeName(name).toLowerCase();
}

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function isoDate(year: number, month: number, day: number): IsoDate | null {
  const date = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isIsoDate(date) ? date : null;
}

/**
 * Reads the dates spreadsheets show: 1/15/2026, 1/15/26, 2026-01-15, and
 * Jan 15, 2026. A time after the date is ignored. Returns null for
 * anything else, or a date that doesn't exist.
 */
export function parseSheetDate(text: string): IsoDate | null {
  const value = text.trim().replace(/\s+\d{1,2}:\d{2}(:\d{2})?(\s*[ap]\.?m\.?)?$/i, "");

  let match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(value);
  if (match) return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));

  match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})$/.exec(value);
  if (match) {
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    return isoDate(year, Number(match[1]), Number(match[2]));
  }

  match = /^([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/i.exec(value);
  if (match) {
    const word = match[1].toLowerCase();
    const month = MONTH_NAMES.findIndex((name) => name.startsWith(word)) + 1;
    return month > 0 ? isoDate(Number(match[3]), month, Number(match[2])) : null;
  }

  return null;
}

/** "Cafe", "café", and "YOUTH" all count. */
export function parseSheetType(text: string): RequestType | null {
  const value = text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return value === "cafe" || value === "youth" ? value : null;
}

function dateProblem(text: string, today: IsoDate): { date?: IsoDate; message?: string } {
  if (!text.trim()) return { message: "The date is blank." };
  const date = parseSheetDate(text);
  if (!date) return { message: `The date “${text.trim()}” isn't a date. Use a format like 1/15/2026.` };
  if (date < MIN_PURCHASE_DATE) return { message: "The date can't be before 2000." };
  if (date > today) return { message: "The date can't be in the future." };
  return { date };
}

function amountProblem(text: string): { cents?: number; message?: string } {
  if (!text.trim()) return { message: "The amount is blank." };
  const cents = parseAmountToCents(text);
  if (cents === null) return { message: `The amount “${text.trim()}” isn't a dollar amount above $0.` };
  if (cents > MAX_REQUEST_CENTS) return { message: `The amount can't be more than ${formatCents(MAX_REQUEST_CENTS)}.` };
  return { cents };
}

function typeProblem(text: string): { type?: RequestType; message?: string } {
  if (!text.trim()) return { message: "The type is blank. Use Cafe or Youth." };
  const type = parseSheetType(text);
  return type ? { type } : { message: `The type “${text.trim()}” isn't Cafe or Youth.` };
}

/** Finds each column by its header, or null when the first row isn't a header. */
function headerColumns(first: string[]): Partial<Record<ImportColumn, number>> | null {
  const cells = first.map((cell) => cell.trim().toLowerCase());
  const columns: Partial<Record<ImportColumn, number>> = {};
  for (const column of IMPORT_COLUMNS) {
    const index = cells.findIndex((cell) => HEADER_NAMES[column].includes(cell));
    if (index >= 0) columns[column] = index;
  }
  // A header row names at least two columns. A date alone could be data.
  return Object.keys(columns).length >= 2 ? columns : null;
}

/**
 * Reads and checks every row of a spreadsheet with the columns Date, Name,
 * Amount, Type, and Notes. With a header row, the columns can be in any
 * order and extra ones are ignored. Without one, they're read in that
 * order. Blank rows are skipped. Each row either comes back ready to import
 * or with everything wrong with it.
 */
export function parseImport(text: string, today: IsoDate): ParsedImport {
  const table = parseTable(text);
  const header = table.length > 0 ? headerColumns(table[0]) : null;

  if (header) {
    const missing = REQUIRED_COLUMNS.filter((column) => header[column] === undefined);
    if (missing.length > 0) {
      const names = missing.map((column) => IMPORT_COLUMN_LABELS[column]).join(", ");
      return { ok: false, error: `The header row is missing ${missing.length === 1 ? "a column" : "columns"}: ${names}.` };
    }
  }

  const columns: Partial<Record<ImportColumn, number>> =
    header ?? Object.fromEntries(IMPORT_COLUMNS.map((column, index) => [column, index]));

  const rows: ImportRow[] = [];
  const problems: ImportProblem[] = [];

  table.forEach((cells, index) => {
    if (header && index === 0) return;
    if (cells.every((cell) => cell.trim() === "")) return;

    const cell = (column: ImportColumn) => {
      const at = columns[column];
      return at === undefined ? "" : (cells[at] ?? "");
    };
    const line = index + 1;
    const messages: string[] = [];

    const { date, message: dateMessage } = dateProblem(cell("date"), today);
    if (dateMessage) messages.push(dateMessage);

    const name = normalizeName(cell("name"));
    if (!name) messages.push("The name is blank.");
    else if (name.length > MAX_NAME) messages.push(`Keep the name to ${MAX_NAME} characters or fewer.`);

    const { cents, message: amountMessage } = amountProblem(cell("amount"));
    if (amountMessage) messages.push(amountMessage);

    const { type, message: typeMessage } = typeProblem(cell("type"));
    if (typeMessage) messages.push(typeMessage);

    const notes = cell("notes").trim();
    if (notes.length > MAX_NOTES) {
      messages.push(`Keep the notes to ${MAX_NOTES.toLocaleString("en-US")} characters or fewer.`);
    }

    if (messages.length > 0 || !date || cents === undefined || !type) {
      problems.push({ line, messages });
      return;
    }
    rows.push({ line, date, name, amount_cents: cents, type, notes });
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

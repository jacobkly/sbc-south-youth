/** A CSV cell: text, a number, or blank. */
export type CsvValue = string | number | null | undefined;

/** Tells Excel the file is UTF-8, so names with accents show correctly. */
const BYTE_ORDER_MARK = "﻿";

/** Text a spreadsheet would run as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One field, quoted per RFC 4180 when it holds a comma, quote, or line
 * break. Text that starts like a formula gets a leading apostrophe, so a
 * spreadsheet shows it instead of running it.
 */
export function csvField(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** A whole CSV file: a byte order mark, the header, then one line per row, each ending in CRLF. */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  const lines = [header, ...rows].map((row) => row.map(csvField).join(","));
  return `${BYTE_ORDER_MARK}${lines.join("\r\n")}\r\n`;
}

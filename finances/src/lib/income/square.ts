import { addDays, formatDate, isIsoDate, type IsoDate } from "@/lib/dates";
import { parseSheetDate, parseTable } from "@/lib/import/parse";
import type { CafeLines } from "@/lib/income/cafe";
import { isWeekEnding, weekStartOf } from "@/lib/income/weeks";

/**
 * Reads Square's sales summary export: one `label,value` row per line, with
 * money like "$1,234.56" and amounts taken off in parentheses. The Summary
 * view has no dates in it, so the week comes from the file's name,
 * `sales-summary-2026-10-05-2026-10-11.csv`. The Weekly and Daily views have
 * a value column for each stretch of days, which are added together. Square's
 * weeks run Sunday to Saturday, so even one of ours comes as two columns.
 * Rows it doesn't know, like the fee breakdown, payment methods, and
 * transaction counts, are skipped.
 */

// Matches the cafe_weeks column checks.
const MAX_LINE_CENTS = 100_000_000;

/** Square's rows this reads, by lowercase label. */
const ROWS = {
  gross: "gross sales",
  returns: "returns",
  discounts: "discounts & comps",
  net: "net sales",
  deferred: "deferred sales",
  giftCardSales: "gift card sales",
  taxes: "taxes",
  tips: "tips",
  totalSales: "total sales",
  payments: "total payments collected",
  giftCardRedeemed: "gift card redeemed",
  fees: "fees",
  netTotal: "net total",
} as const;

type Row = keyof typeof ROWS;

/** Rows every summary has. Square can leave out the rest when they're $0. */
const REQUIRED: readonly Row[] = ["gross", "discounts", "net", "totalSales", "payments", "netTotal"];

/** How each row is named in a message. */
const LABELS: Record<Row, string> = {
  gross: "Gross sales",
  returns: "Returns",
  discounts: "Discounts & comps",
  net: "Net sales",
  deferred: "Deferred sales",
  giftCardSales: "Gift card sales",
  taxes: "Taxes",
  tips: "Tips",
  totalSales: "Total sales",
  payments: "Total payments collected",
  giftCardRedeemed: "Gift card redeemed",
  fees: "Fees",
  netTotal: "Net total",
};

export type ParsedSalesSummary =
  | {
      ok: true;
      /** The Sunday the week ends, or null when the file's name has no dates and the person picks the week. */
      week_ending: IsoDate | null;
      lines: CafeLines;
    }
  | { ok: false; error: string };

/** Reads "$1,234.56", "($19.50)", or "-$5.00" into cents. Null for anything else. */
export function parseSquareMoney(text: string): number | null {
  let value = text.trim();
  let sign = 1;
  if (/^\(.*\)$/.test(value)) {
    value = value.slice(1, -1).trim();
    sign = -1;
  }
  if (value.startsWith("-")) {
    value = value.slice(1).trim();
    sign = -sign;
  }
  const match = /^\$(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})$/.exec(value);
  if (!match) return null;
  return sign * (Number(match[1].replace(/,/g, "")) * 100 + Number(match[2]));
}

function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

/** A row's amount, added across the file's columns. Null unless each column that has a value holds money. */
function rowAmount(cells: readonly string[]): number | null {
  let total: number | null = null;
  for (const cell of cells) {
    if (cell.trim() === "") continue;
    const cents = parseSquareMoney(cell);
    if (cents === null) return null;
    total = (total ?? 0) + cents;
  }
  return total;
}

type Dates = { start: IsoDate; end: IsoDate };

/** The dates in a file name like `sales-summary-2026-10-05-2026-10-11 (1).csv`. */
function datesInName(fileName: string): Dates | null {
  const match = /(\d{4}-\d{2}-\d{2})-(\d{4}-\d{2}-\d{2})/.exec(fileName);
  if (!match || !isIsoDate(match[1]) || !isIsoDate(match[2])) return null;
  return { start: match[1], end: match[2] };
}

/** The days a column covers, from a header like "1/18/2026" or "1/12/2026 – 1/17/2026". */
function datesInHeader(header: string): Dates | null {
  const [start, end = start, ...rest] = header.split(/\s+[–-]\s+/).map((part) => parseSheetDate(part));
  return start && end && rest.length === 0 ? { start, end } : null;
}

/**
 * The days a file's columns cover together. Null unless every column is dates
 * and each starts the day after the last, so a total is never added in.
 */
function datesInColumns(headers: readonly string[]): Dates | null {
  const columns: Dates[] = [];
  for (const header of headers) {
    const column = datesInHeader(header);
    const previous = columns.at(-1);
    if (!column || (previous && column.start !== addDays(previous.end, 1))) return null;
    columns.push(column);
  }
  const first = columns.at(0);
  const last = columns.at(-1);
  return first && last ? { start: first.start, end: last.end } : null;
}

/** The hours of each day the file covers, when it isn't the whole day. */
function partOfDay(title: string): string | null {
  const match = /(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i.exec(title);
  if (!match) return null;
  const range = `${match[1]}-${match[2]}`;
  return /^12:00\s*AM-11:59\s*PM$/i.test(range) ? null : range;
}

/** Reads one sales summary file for one Monday to Sunday week. */
export function parseSalesSummary(text: string, fileName: string): ParsedSalesSummary {
  const table = parseTable(text);
  const values = new Map<Row, number>();
  const labels = new Map<string, Row>(Object.entries(ROWS).map(([row, label]) => [label, row as Row]));

  for (const [label = "", ...cells] of table) {
    const row = labels.get(normalizeLabel(label));
    if (!row || values.has(row)) continue;
    const cents = rowAmount(cells);
    if (cents !== null) values.set(row, cents);
  }

  const missing = REQUIRED.find((row) => !values.has(row));
  if (missing) {
    return { ok: false, error: `This doesn't look like Square's sales summary. It has no ${LABELS[missing]} row.` };
  }

  const hours = partOfDay(table[0]?.[0] ?? "");
  if (hours) {
    return { ok: false, error: `This file covers only ${hours} each day. Export it from Square with All day picked.` };
  }

  const [first = "", ...rest] = table[0] ?? [];
  const headers = labels.has(normalizeLabel(first)) ? [] : rest.filter((cell) => cell.trim() !== "");
  const named = datesInName(fileName);
  const inColumns = headers.length > 0 ? datesInColumns(headers) : null;
  if (headers.length > 0 && (!inColumns || (named && (inColumns.start !== named.start || inColumns.end !== named.end)))) {
    return {
      ok: false,
      error: "Square split this file into columns that don't cover the whole week. Export it again in the Summary view.",
    };
  }

  let week_ending: IsoDate | null = null;
  const dates = named ?? inColumns;
  if (dates) {
    if (!isWeekEnding(dates.end) || weekStartOf(dates.end) !== dates.start) {
      return {
        ok: false,
        error: `This file covers ${formatDate(dates.start)} to ${formatDate(dates.end)}. Export one week from Square, Monday to Sunday.`,
      };
    }
    week_ending = dates.end;
  }

  const get = (row: Row) => values.get(row) ?? 0;
  // Square shows what it takes off as negative amounts.
  const returns = Math.abs(get("returns"));
  const discounts = Math.abs(get("discounts"));
  const fees = Math.abs(get("fees"));

  const sums: [Row, number][] = [
    ["net", get("gross") - returns - discounts],
    ["totalSales", get("net") + get("deferred") + get("taxes") + get("tips")],
    ["payments", get("totalSales")],
    ["netTotal", get("payments") - fees],
  ];
  const wrong = sums.find(([row, sum]) => get(row) !== sum);
  if (wrong) {
    return {
      ok: false,
      error: `Square's lines don't add up to its ${LABELS[wrong[0]]}. Export the file again, or type the week in by hand.`,
    };
  }

  if (get("deferred") !== get("giftCardSales")) {
    return { ok: false, error: "This week has deferred sales that aren't gift cards. Type the week in by hand." };
  }

  const lines: CafeLines = {
    sales_cents: get("gross"),
    returns_cents: returns,
    discounts_cents: discounts,
    gift_card_sales_cents: get("giftCardSales"),
    gift_card_redeemed_cents: get("giftCardRedeemed"),
    taxes_cents: get("taxes"),
    tips_cents: get("tips"),
    fees_cents: fees,
  };

  const rowOf: Record<keyof CafeLines, Row> = {
    sales_cents: "gross",
    returns_cents: "returns",
    discounts_cents: "discounts",
    gift_card_sales_cents: "giftCardSales",
    gift_card_redeemed_cents: "giftCardRedeemed",
    taxes_cents: "taxes",
    tips_cents: "tips",
    fees_cents: "fees",
  };
  for (const [line, cents] of Object.entries(lines) as [keyof CafeLines, number][]) {
    if (cents < 0) return { ok: false, error: `${LABELS[rowOf[line]]} is below $0 this week. Type the week in by hand.` };
    if (cents > MAX_LINE_CENTS) {
      return { ok: false, error: `${LABELS[rowOf[line]]} is over $1,000,000. Type the week in by hand.` };
    }
  }

  return { ok: true, week_ending, lines };
}

import { parseAmountToCents } from "@/lib/money";

/**
 * A request's receipts ("lines"): each has an amount, and optionally a vendor
 * and files. The request's total and vendor list come from its lines, which
 * the database keeps in step.
 */

/** Matches the `request_lines` position check, and the limit on files. */
export const MAX_LINES = 10;

/** One receipt in the form, with the amount still as typed. */
export type RequestLineValues = { id: string; amount: string; vendor: string };

/**
 * A new line id. The form picks it, so a retried save updates the same lines,
 * and files can be uploaded to a line before the page reloads.
 */
export function newLineId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // randomUUID only exists on https and localhost. getRandomValues works everywhere.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function blankLine(): RequestLineValues {
  return { id: newLineId(), amount: "", vendor: "" };
}

/** The request's total: its receipts added up. */
export function linesTotal(lines: readonly { amount_cents: number }[]): number {
  return lines.reduce((sum, line) => sum + line.amount_cents, 0);
}

/** The total so far while typing. An amount that's blank or doesn't parse yet counts as nothing. */
export function enteredTotal(lines: readonly Pick<RequestLineValues, "amount">[]): number {
  return lines.reduce((sum, line) => sum + (parseAmountToCents(line.amount) ?? 0), 0);
}

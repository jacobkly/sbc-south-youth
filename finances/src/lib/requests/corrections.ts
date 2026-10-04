import { laDateOf, type IsoDate } from "@/lib/dates";
import type { Database, Json } from "@/lib/database.types";
import { MAX_NOTE, paidAtFor, type PaymentMethod } from "./actions";
import { linesTotal } from "./lines";
import type { RequestInput, RequestType } from "./schema";

/**
 * Corrections fix a request that's already approved or paid. Before one is
 * saved, the owner sees what will change, worked out the way
 * `correct_request()` records it, so the popup and the history agree.
 */

/** A request's fields as a correction compares them, in their saved form. */
export type CorrectionSnapshot = {
  type: RequestType;
  purchase_date: string;
  description: string | null;
  event_name: string | null;
  no_receipt: boolean;
  no_receipt_reason: string | null;
  lines: { amount_cents: number; vendor: string | null }[];
  /** Null unless it's paid. */
  paid_at: string | null;
  payment_method: PaymentMethod | null;
  payment_reference: string | null;
};

export type CorrectionChanges = Record<string, { from: Json; to: Json }>;

/** Like the database's `vendor_list()`: each vendor once, in order, keeping the first spelling. */
export function vendorList(vendors: readonly (string | null)[]): string | null {
  const seen = new Map<string, string>();
  for (const vendor of vendors) {
    const trimmed = vendor?.trim();
    if (trimmed && !seen.has(trimmed.toLowerCase())) seen.set(trimmed.toLowerCase(), trimmed);
  }
  return seen.size > 0 ? [...seen.values()].join(", ") : null;
}

const FIELDS = [
  "type",
  "amount_cents",
  "purchase_date",
  "vendor",
  "description",
  "event_name",
  "no_receipt",
  "no_receipt_reason",
  "paid_at",
  "payment_method",
  "payment_reference",
] as const;

function flatten(snapshot: CorrectionSnapshot): Record<(typeof FIELDS)[number], Json> {
  return {
    ...snapshot,
    amount_cents: linesTotal(snapshot.lines),
    vendor: vendorList(snapshot.lines.map((line) => line.vendor)),
  };
}

function sameLines(a: CorrectionSnapshot["lines"], b: CorrectionSnapshot["lines"]): boolean {
  return (
    a.length === b.length &&
    a.every((line, i) => line.amount_cents === b[i].amount_cents && line.vendor === b[i].vendor)
  );
}

/**
 * What a correction changes, in the shape of a history entry's `changes`.
 * The receipts are listed only when there's more than one, since with one the
 * amount and vendor already say it all. Null when nothing changes.
 */
export function correctionChanges(before: CorrectionSnapshot, after: CorrectionSnapshot): CorrectionChanges | null {
  const was = flatten(before);
  const now = flatten(after);
  const changes: CorrectionChanges = {};
  for (const field of FIELDS) {
    if (was[field] !== now[field]) changes[field] = { from: was[field], to: now[field] };
  }
  if (!sameLines(before.lines, after.lines) && Math.max(before.lines.length, after.lines.length) > 1) {
    changes.lines = { from: before.lines, to: after.lines };
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

/** "2 files added, 1 removed", or null when the files stay as they are. */
export function filesSummary(added: number, removed: number): string | null {
  const files = (n: number) => (n === 1 ? "1 file" : `${n} files`);
  if (added > 0 && removed > 0) return `${files(added)} added, ${removed} removed`;
  if (added > 0) return `${files(added)} added`;
  if (removed > 0) return `${files(removed)} removed`;
  return null;
}

/**
 * When it was paid, as a correction sends it. A paid date that stays the same
 * keeps the exact time it was recorded, so only a real change shows up.
 */
export function correctedPaidAt(original: string, paidDate: IsoDate, now: Date = new Date()): string {
  return laDateOf(original) === paidDate ? original : paidAtFor(paidDate, now);
}

/** Why it's being corrected, checked the way `correct_request()` checks it. */
export function correctionReasonError(reason: string): string | null {
  const trimmed = reason.trim();
  if (!trimmed) return "Say what was wrong.";
  if (trimmed.length > MAX_NOTE) return `Keep the reason to ${MAX_NOTE.toLocaleString("en-US")} characters or fewer.`;
  return null;
}

/** A paid request's payment, ready to send. */
export type CorrectedPayment = { paid_at: string; payment_method: PaymentMethod; payment_reference: string | null };

type CorrectRequestArgs = Database["public"]["Functions"]["correct_request"]["Args"];

/**
 * The `correct_request` call for checked values. There's no payee, since a
 * correction can't change who it's paid to, and no payment unless it's paid.
 */
export function correctRequestArgs(
  requestId: string,
  input: RequestInput,
  payment: CorrectedPayment | null,
  reason: string,
): CorrectRequestArgs {
  // The generated types don't know these arguments can be null. The function handles it.
  return {
    p_request_id: requestId,
    p_type: input.type,
    p_purchase_date: input.purchase_date,
    p_description: input.description,
    p_event_name: input.event_name,
    p_no_receipt: input.no_receipt,
    p_no_receipt_reason: input.no_receipt_reason,
    p_lines: input.lines,
    p_paid_at: payment?.paid_at ?? null,
    p_payment_method: payment?.payment_method ?? null,
    p_payment_reference: payment?.payment_reference ?? null,
    p_reason: reason,
  } as CorrectRequestArgs;
}

/** What a correction would leave, to compare with the request as saved. */
export function correctionSnapshot(input: RequestInput, payment: CorrectedPayment | null): CorrectionSnapshot {
  return {
    type: input.type,
    purchase_date: input.purchase_date,
    description: input.description,
    event_name: input.event_name,
    no_receipt: input.no_receipt,
    no_receipt_reason: input.no_receipt_reason,
    lines: input.lines.map((line) => ({ amount_cents: line.amount_cents, vendor: line.vendor })),
    paid_at: payment?.paid_at ?? null,
    payment_method: payment?.payment_method ?? null,
    payment_reference: payment?.payment_reference ?? null,
  };
}

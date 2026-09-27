import type { Tables } from "@/lib/database.types";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/requests/actions";
import type { RequestStatus } from "@/lib/requests/format";

/** What the Requests tab's breakdowns read from each request. */
export type BreakdownRow = Pick<
  Tables<"reimbursement_requests">,
  "status" | "amount_cents" | "missing_receipt" | "payment_method"
>;

/** How many requests fall in one group, and what they add up to. */
export type Slice<Key extends string> = { key: Key; count: number; cents: number };

/** Adds up the rows in each group, keeping the groups in the order given. */
function tally<Key extends string>(rows: BreakdownRow[], keys: readonly Key[], groupOf: (row: BreakdownRow) => Key | null) {
  const slices = new Map(keys.map((key) => [key, { key, count: 0, cents: 0 }]));
  for (const row of rows) {
    const key = groupOf(row);
    const slice = key === null ? undefined : slices.get(key);
    if (!slice) continue;
    slice.count += 1;
    slice.cents += row.amount_cents;
  }
  return [...slices.values()];
}

/** The statuses in the order a request moves through them, then the ones that close it early. */
const STATUS_ORDER = [
  "draft",
  "submitted",
  "needs_info",
  "approved",
  "paid",
  "rejected",
  "cancelled",
] as const satisfies readonly RequestStatus[];

/** Each status the report has, in the order a request moves through them. */
export function statusBreakdown(rows: BreakdownRow[]): Slice<RequestStatus>[] {
  return tally(rows, STATUS_ORDER, (row) => row.status).filter((slice) => slice.count > 0);
}

export const SIZE_BANDS = ["under_25", "25_to_50", "50_to_100", "100_up"] as const;

export type SizeBand = (typeof SIZE_BANDS)[number];

export const SIZE_BAND_LABELS: Record<SizeBand, string> = {
  under_25: "Under $25",
  "25_to_50": "$25–50",
  "50_to_100": "$50–100",
  "100_up": "$100 or more",
};

function sizeBand(cents: number): SizeBand {
  if (cents < 2500) return "under_25";
  if (cents < 5000) return "25_to_50";
  if (cents < 10000) return "50_to_100";
  return "100_up";
}

/** Requests by size. Every band shows, even an empty one. $25.00 counts as $25–50. */
export function sizeBreakdown(rows: BreakdownRow[]): Slice<SizeBand>[] {
  return tally(rows, SIZE_BANDS, (row) => sizeBand(row.amount_cents));
}

export type ReceiptGroup = "with" | "missing";

export const RECEIPT_GROUP_LABELS: Record<ReceiptGroup, string> = {
  with: "Every receipt on file",
  missing: "Missing a receipt",
};

/**
 * Requests with every receipt on file, then those missing one, like the
 * Requests filter. Both show, so none missing reads as zero.
 */
export function receiptBreakdown(rows: BreakdownRow[]): Slice<ReceiptGroup>[] {
  return tally(rows, ["with", "missing"] as const, (row) => (row.missing_receipt ? "missing" : "with"));
}

/** How paid requests were paid, most paid first. Requests not yet paid are left out. */
export function paymentMethodBreakdown(rows: BreakdownRow[]): Slice<PaymentMethod>[] {
  return tally(rows, PAYMENT_METHODS, (row) => (row.status === "paid" ? row.payment_method : null))
    .filter((slice) => slice.count > 0)
    .sort((a, b) => b.cents - a.cents || b.count - a.count);
}

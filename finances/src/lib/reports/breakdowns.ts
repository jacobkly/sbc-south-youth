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

/** How many vendors or events show before the rest are added up in one row. */
export const TOP_NAMES = 10;

/** A vendor or event. `key` is "name:" and the grouped name, "other" for the rest added up, or "none". */
export type NamedSlice = Slice<string> & { label: string };

/** Something spent under a name, or under no name. */
type NamedAmount = { name: string | null; cents: number };

/**
 * Adds up amounts by name, most money first. Names that differ only in case
 * or spacing count once, using the first spelling seen. Past the top `limit`,
 * the rest are added up in one row, unless that's just one. Amounts with no
 * name go last. Empty when nothing has a name.
 */
function byName(
  amounts: readonly NamedAmount[],
  words: { none: string; others: (count: number) => string },
  limit: number,
): NamedSlice[] {
  const groups = new Map<string, NamedSlice>();
  const none: NamedSlice = { key: "none", label: words.none, count: 0, cents: 0 };
  for (const { name, cents } of amounts) {
    const label = name?.trim();
    let group = none;
    if (label) {
      const key = `name:${label.toLowerCase().replace(/\s+/g, " ")}`;
      group = groups.get(key) ?? { key, label, count: 0, cents: 0 };
      groups.set(key, group);
    }
    group.count += 1;
    group.cents += cents;
  }
  if (groups.size === 0) return [];

  const named = [...groups.values()].sort(
    (a, b) => b.cents - a.cents || b.count - a.count || a.label.localeCompare(b.label),
  );
  const shown = named.length <= limit + 1 ? named : named.slice(0, limit);
  if (shown.length < named.length) {
    const rest = named.slice(limit);
    shown.push({
      key: "other",
      label: words.others(rest.length),
      count: rest.reduce((sum, slice) => sum + slice.count, 0),
      cents: rest.reduce((sum, slice) => sum + slice.cents, 0),
    });
  }
  return none.count > 0 ? [...shown, none] : shown;
}

/** What vendorBreakdown reads from each request: its receipts' amounts and vendors. */
export type VendorRow = { lines: readonly Pick<Tables<"request_lines">, "vendor" | "amount_cents">[] };

/**
 * Where the money was spent, from each receipt, so a request with receipts
 * from two stores counts under both. `count` is receipts, not requests.
 */
export function vendorBreakdown(rows: readonly VendorRow[], limit = TOP_NAMES): NamedSlice[] {
  const amounts = rows.flatMap((row) => row.lines.map((line) => ({ name: line.vendor, cents: line.amount_cents })));
  return byName(amounts, { none: "No vendor", others: (count) => `${count.toLocaleString()} other vendors` }, limit);
}

/** Spending on each event. */
export function eventBreakdown(
  rows: readonly Pick<Tables<"reimbursement_requests">, "event_name" | "amount_cents">[],
  limit = TOP_NAMES,
): NamedSlice[] {
  const amounts = rows.map((row) => ({ name: row.event_name, cents: row.amount_cents }));
  return byName(amounts, { none: "No event", others: (count) => `${count.toLocaleString()} other events` }, limit);
}

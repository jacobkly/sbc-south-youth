import { daysBetween, laDateOf, type IsoDate } from "@/lib/dates";
import type { Slice } from "./breakdowns";
import type { ReportBasis } from "./filters";
import { bucketIndex, reportDate, type BeforeBucket, type Timeline, type TimelineRow } from "./timeline";

/** What the Timing tab reads from each request. */
export type TimingRow = TimelineRow & {
  submitted_at: string | null;
  approved_at: string | null;
  no_receipt_reason: string | null;
};

/** The no-receipt reason import_paid_requests gives every request it imports. */
export const IMPORTED_REASON = "Imported from spreadsheet";

/** Whole Los Angeles calendar days from one instant to another, never below 0. */
function daysFrom(from: IsoDate, to: IsoDate): number {
  return Math.max(0, daysBetween(from, to));
}

/**
 * Days from purchase to the LA date it was paid. Null until it's paid, and
 * for imported requests, since the spreadsheet had one date for both.
 */
export function paidDays(row: TimingRow): number | null {
  if (!row.paid_at || row.no_receipt_reason === IMPORTED_REASON) return null;
  return daysFrom(row.purchase_date, laDateOf(row.paid_at));
}

/** Days from submitted to approved, for requests that were both. */
function approvalDays(row: TimingRow): number | null {
  if (!row.submitted_at || !row.approved_at) return null;
  return daysFrom(laDateOf(row.submitted_at), laDateOf(row.approved_at));
}

/**
 * Days from approved to paid. Recording a request as paid in one step
 * approves it at the moment it's paid, so those are left out.
 */
function paymentDays(row: TimingRow): number | null {
  if (!row.approved_at || !row.paid_at) return null;
  if (Date.parse(row.approved_at) === Date.parse(row.paid_at)) return null;
  return daysFrom(laDateOf(row.approved_at), laDateOf(row.paid_at));
}

/** The middle value, or the average of the two middle values. Null for nothing. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** A number of days in words, e.g. "Same day", "1 day", or "2.5 days". */
export function formatDays(days: number): string {
  if (days === 0) return "Same day";
  return `${days.toLocaleString("en-US", { maximumFractionDigits: 1 })} ${days === 1 ? "day" : "days"}`;
}

/** How many requests a wait was measured on, and its median and longest in days. */
export type Wait = { count: number; median: number | null; longest: number | null };

function waitOf(rows: readonly TimingRow[], daysOf: (row: TimingRow) => number | null): Wait {
  const days = rows.map(daysOf).filter((value) => value !== null);
  return { count: days.length, median: median(days), longest: days.length > 0 ? Math.max(...days) : null };
}

export type Waits = {
  boughtToPaid: Wait;
  submittedToApproved: Wait;
  approvedToPaid: Wait;
  /** Paid requests left out of bought to paid because they were imported. */
  imported: number;
};

/** How long requests wait at each step, in LA calendar days. */
export function waits(rows: readonly TimingRow[]): Waits {
  return {
    boughtToPaid: waitOf(rows, paidDays),
    submittedToApproved: waitOf(rows, approvalDays),
    approvedToPaid: waitOf(rows, paymentDays),
    imported: rows.filter((row) => row.paid_at && row.no_receipt_reason === IMPORTED_REASON).length,
  };
}

export const DAY_BANDS = ["same_day", "1_to_7", "8_to_14", "15_to_30", "31_to_60", "over_60"] as const;

export type DayBand = (typeof DAY_BANDS)[number];

export const DAY_BAND_LABELS: Record<DayBand, string> = {
  same_day: "Same day",
  "1_to_7": "1–7 days",
  "8_to_14": "8–14 days",
  "15_to_30": "15–30 days",
  "31_to_60": "31–60 days",
  over_60: "Over 60 days",
};

function dayBand(days: number): DayBand {
  if (days === 0) return "same_day";
  if (days <= 7) return "1_to_7";
  if (days <= 14) return "8_to_14";
  if (days <= 30) return "15_to_30";
  if (days <= 60) return "31_to_60";
  return "over_60";
}

/** Paid requests by how many days they took from purchase to paid. Every band is kept, so it reads as a histogram. */
export function paidDaysBreakdown(rows: readonly TimingRow[]): Slice<DayBand>[] {
  const bands = new Map(DAY_BANDS.map((key) => [key, { key, count: 0, cents: 0 }]));
  for (const row of rows) {
    const days = paidDays(row);
    if (days === null) continue;
    const band = bands.get(dayBand(days))!;
    band.count += 1;
    band.cents += row.amount_cents;
  }
  return [...bands.values()];
}

/** How many paid requests fell in one bucket, and their median days from purchase to paid. */
export type DaysBucket = { count: number; median: number | null };

/** The median days from purchase to paid in each of the timeline's buckets, placed by the report's date. */
export function paidDaysTimeline(rows: readonly TimingRow[], { buckets }: Timeline, basis: ReportBasis): DaysBucket[] {
  const days: number[][] = buckets.map(() => []);
  if (buckets.length > 0) {
    const first = buckets[0].start;
    const last = buckets[buckets.length - 1].end;
    for (const row of rows) {
      const date = reportDate(row, basis);
      const value = paidDays(row);
      if (!date || value === null || date < first || date > last) continue;
      days[bucketIndex(buckets, date)].push(value);
    }
  }
  return days.map((values) => ({ count: values.length, median: median(values) }));
}

/** The running total at the end of each bucket, and the period before's at the same point. */
export type RunningPoint = { cents: number | null; before: number | null };

/**
 * The report's running total through its buckets, stopping after today so a
 * running period's line doesn't run flat into the future. The period before's
 * runs until it ends.
 */
export function runningTotals(
  { buckets }: Timeline,
  before: readonly BeforeBucket[] | null,
  today: IsoDate,
): RunningPoint[] {
  let cents = 0;
  let earlier = 0;
  return buckets.map((bucket, index) => {
    cents += bucket.cents;
    const match = before?.[index] ?? null;
    if (match) earlier += match.cents;
    return { cents: bucket.start <= today ? cents : null, before: match ? earlier : null };
  });
}

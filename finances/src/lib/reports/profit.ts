import type { DateRange, IsoDate } from "@/lib/dates";
import { earnedIncome, type IncomeSources } from "@/lib/income/earned";
import type { RequestStatus } from "@/lib/requests/format";
import type { ReportBasis } from "./filters";
import { wasSpent, type ReportIncome } from "./income";
import { bucketIndex, reportDate, spans, timelineUnit, type TimelineRow, type TimelineUnit } from "./timeline";

/** One pair of bars: its dates, and what was earned and spent in them. */
export type ProfitBucket = DateRange & { income: number; expenses: number; profit: number };

export type ProfitTimeline = { unit: TimelineUnit; buckets: ProfitBucket[] };

const NO_INCOME: IncomeSources = { youth: [], weeks: [], paybacks: [] };

/**
 * A report's income and expenses over its range, in the same buckets as its
 * requests chart. Income counts like `incomeTotals`, and so do expenses, so
 * the bars add up to the totals. Years start at the first one with either.
 */
export function profitTimeline(
  { youth, weeks, paybacks }: ReportIncome,
  rows: readonly (TimelineRow & { status: RequestStatus })[],
  range: DateRange,
  basis: ReportBasis,
): ProfitTimeline {
  const unit = timelineUnit(range);
  const buckets: ProfitBucket[] = spans(range, unit).map((span) => ({ ...span, income: 0, expenses: 0, profit: 0 }));
  let first = buckets.length;

  function add(date: IsoDate | null, field: "income" | "expenses", cents: number) {
    if (!date || date < range.start || date > range.end) return;
    const index = bucketIndex(buckets, date);
    buckets[index][field] += cents;
    if (cents !== 0) first = Math.min(first, index);
  }

  for (const entry of youth) {
    add(entry.received_on, "income", earnedIncome({ ...NO_INCOME, youth: [entry] }).total);
  }
  for (const week of weeks) add(week.week_ending, "income", earnedIncome({ ...NO_INCOME, weeks: [week] }).total);
  for (const payback of paybacks) {
    add(payback.received_on, "income", earnedIncome({ ...NO_INCOME, paybacks: [payback] }).total);
  }
  for (const row of rows) if (wasSpent(row)) add(reportDate(row, basis), "expenses", row.amount_cents);

  for (const bucket of buckets) bucket.profit = bucket.income - bucket.expenses;
  return { unit, buckets: unit === "year" && first < buckets.length ? buckets.slice(first) : buckets };
}

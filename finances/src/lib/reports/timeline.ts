import {
  addDays,
  daysBetween,
  formatDate,
  laDateOf,
  monthShortName,
  periodContaining,
  periodLabel,
  periodRange,
  shiftPeriod,
  type DateRange,
  type IsoDate,
  type MonthPeriod,
} from "@/lib/dates";
import { REQUEST_TYPES, type RequestType } from "@/lib/requests/schema";
import type { ReportBasis } from "./filters";

/** How much time each bar of a report's chart covers. */
export type TimelineUnit = "day" | "week" | "month" | "year";

/** Days for a month or shorter, weeks up to a quarter, months up to two years, then years. */
export function timelineUnit({ start, end }: DateRange): TimelineUnit {
  const days = daysBetween(start, end) + 1;
  if (days <= 31) return "day";
  if (days <= 92) return "week";
  if (days <= 731) return "month";
  return "year";
}

export type TimelineRow = {
  type: RequestType;
  amount_cents: number;
  purchase_date: IsoDate;
  paid_at: string | null;
};

/** One bar: its dates, cut to the report's range, and what falls in them. */
export type TimelineBucket = DateRange & {
  cents: number;
  count: number;
  byType: Record<RequestType, number>;
};

export type Timeline = { unit: TimelineUnit; buckets: TimelineBucket[] };

/** A last week shorter than this joins the week before, so no bar covers only a day or two. */
const SHORTEST_WEEK = 4;

/** The first day of the next bucket. Weeks count from the start of the range. */
function nextStart(date: IsoDate, unit: TimelineUnit): IsoDate {
  switch (unit) {
    case "day":
      return addDays(date, 1);
    case "week":
      return addDays(date, 7);
    case "month":
    case "year":
      return periodRange(shiftPeriod(periodContaining(unit, date), 1)).start;
  }
}

/** Every bucket in the range, in order, with no gaps. */
function spans(range: DateRange, unit: TimelineUnit): DateRange[] {
  const result: DateRange[] = [];
  for (let start = range.start; start <= range.end; ) {
    const next = nextStart(start, unit);
    const end = next <= range.end ? addDays(next, -1) : range.end;
    result.push({ start, end });
    start = next;
  }
  const last = result[result.length - 1];
  if (unit === "week" && result.length > 1 && daysBetween(last.start, last.end) + 1 < SHORTEST_WEEK) {
    result.pop();
    result[result.length - 1].end = last.end;
  }
  return result;
}

/** The date that puts a request in the report: its purchase date, or the LA date it was paid. */
export function reportDate(row: Pick<TimelineRow, "purchase_date" | "paid_at">, basis: ReportBasis): IsoDate | null {
  if (basis === "paid") return row.paid_at ? laDateOf(row.paid_at) : null;
  return row.purchase_date;
}

/** The last bucket that starts on or before the date. */
export function bucketIndex(buckets: readonly DateRange[], date: IsoDate): number {
  let low = 0;
  let high = buckets.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (buckets[middle].start <= date) low = middle;
    else high = middle - 1;
  }
  return low;
}

/**
 * A report's requests over its range, as buckets for a stacked bar chart.
 * Empty buckets are kept, so time reads evenly. Years are the exception:
 * they start at the first year with a request, so a range typed from long
 * ago doesn't open on years of nothing.
 */
export function reportTimeline(rows: readonly TimelineRow[], range: DateRange, basis: ReportBasis): Timeline {
  const unit = timelineUnit(range);
  const buckets: TimelineBucket[] = spans(range, unit).map((span) => ({
    ...span,
    cents: 0,
    count: 0,
    byType: Object.fromEntries(REQUEST_TYPES.map((type) => [type, 0])) as Record<RequestType, number>,
  }));

  for (const row of rows) {
    const date = reportDate(row, basis);
    if (!date || date < range.start || date > range.end) continue;
    const bucket = buckets[bucketIndex(buckets, date)];
    bucket.cents += row.amount_cents;
    bucket.count += 1;
    bucket.byType[row.type] += row.amount_cents;
  }

  const first = buckets.findIndex((bucket) => bucket.count > 0);
  return { unit, buckets: unit === "year" && first > 0 ? buckets.slice(first) : buckets };
}

/** The period before's stretch for one bar and what was spent in it, or null once the period before has ended. */
export type BeforeBucket = (DateRange & { cents: number }) | null;

/** Months since the year 0, for counting the months between two dates. */
function monthNumber(date: IsoDate): number {
  return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
}

/**
 * Where `date` lands when a range starting at `from` is laid over one
 * starting at `to`. Days and weeks line up day by day. Months and years
 * line up by the calendar, landing on the first day of theirs.
 */
function lineUp(date: IsoDate, from: IsoDate, to: IsoDate, unit: TimelineUnit): IsoDate {
  if (unit === "day" || unit === "week") return addDays(to, daysBetween(from, date));
  const steps =
    unit === "month" ? monthNumber(date) - monthNumber(from) : Number(date.slice(0, 4)) - Number(from.slice(0, 4));
  return steps === 0 ? to : periodRange(shiftPeriod(periodContaining(unit, to), steps)).start;
}

/**
 * The period before, lined up with a report's bars: for each bar, the
 * matching stretch of the period before and what was spent in it. A bar
 * past the end of the period before is null, so a running period's line
 * stops at today. A request that lines up past the report's last bar,
 * like August 31 against September, is left out.
 */
export function timelineBefore(
  { unit, buckets }: Timeline,
  range: DateRange,
  before: { range: DateRange; rows: readonly TimelineRow[] },
  basis: ReportBasis,
): BeforeBucket[] {
  const lined: BeforeBucket[] = buckets.map((bucket) => {
    const start = lineUp(bucket.start, range.start, before.range.start, unit);
    if (start > before.range.end) return null;
    const end =
      unit === "day" || unit === "week"
        ? lineUp(bucket.end, range.start, before.range.start, unit)
        : periodRange(periodContaining(unit, start)).end;
    return { start, end: end < before.range.end ? end : before.range.end, cents: 0 };
  });
  if (buckets.length === 0) return lined;

  for (const row of before.rows) {
    const date = reportDate(row, basis);
    if (!date || date < before.range.start || date > before.range.end) continue;
    const at = lineUp(date, before.range.start, range.start, unit);
    // Before the first bar only happens when a years chart skips its empty first years.
    if (at < buckets[0].start || at > range.end) continue;
    const bucket = lined[bucketIndex(buckets, at)];
    if (bucket) bucket.cents += row.amount_cents;
  }
  return lined;
}

const monthDay = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });

function shortDate(date: IsoDate): string {
  return monthDay.format(new Date(`${date}T00:00:00Z`));
}

function monthOf(date: IsoDate): MonthPeriod {
  return { kind: "month", year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
}

/** The axis label under a bar, e.g. "5", "Jul 29", "Sep", or "2026". */
export function bucketTick({ start }: DateRange, unit: TimelineUnit): string {
  switch (unit) {
    case "day":
      return String(Number(start.slice(8)));
    case "week":
      return shortDate(start);
    case "month":
      return monthShortName(monthOf(start));
    case "year":
      return start.slice(0, 4);
  }
}

/**
 * The full name of a bar, e.g. "Sep 5, 2026", "Jul 29 – Aug 4",
 * "September 2026", or "2026". Weeks show the year only when they cross one.
 */
export function bucketLabel({ start, end }: DateRange, unit: TimelineUnit): string {
  switch (unit) {
    case "day":
      return formatDate(start);
    case "week":
      if (start.slice(0, 4) !== end.slice(0, 4)) return `${formatDate(start)} – ${formatDate(end)}`;
      if (start.slice(0, 7) === end.slice(0, 7)) return `${shortDate(start)} – ${Number(end.slice(8))}`;
      return `${shortDate(start)} – ${shortDate(end)}`;
    case "month":
      return periodLabel(monthOf(start));
    case "year":
      return start.slice(0, 4);
  }
}

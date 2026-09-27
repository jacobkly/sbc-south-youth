import { samePointBefore } from "@/lib/dashboard/summary";
import {
  addDays,
  daysBetween,
  formatDate,
  periodContaining,
  periodLabel,
  periodRange,
  shiftPeriod,
  type DateRange,
  type IsoDate,
  type Period,
} from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { bucketLabel, type TimelineUnit } from "./timeline";

/**
 * The period a report compares with, like the dashboard: the one before,
 * up to the same day while the report's period is still running
 * (September 1–27 vs. August 1–27). A custom range compares with the same
 * number of days right before it. It stays a month, quarter, or year when
 * it covers the whole one, so it can be named.
 */
export function comparisonPeriod(period: Period, today: IsoDate): Period {
  const { start, end } = periodRange(period);
  const running = start <= today && today <= end;

  if (period.kind === "custom") {
    const days = daysBetween(start, end) + 1;
    const before = { start: addDays(start, -days), end: addDays(start, -1) };
    if (running) before.end = addDays(before.start, daysBetween(start, today));
    return { kind: "custom", ...before };
  }

  const previous = shiftPeriod(period, -1);
  if (!running) return previous;
  const range = samePointBefore(period, today);
  return range.end === periodRange(previous).end ? previous : { kind: "custom", ...range };
}

const monthDay = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });

function shortDate(date: IsoDate): string {
  return monthDay.format(new Date(`${date}T00:00:00Z`));
}

/**
 * A range written short, e.g. "Aug 1–27, 2026", "Apr 1 – Jun 28, 2026",
 * or "Dec 15, 2025 – Jan 10, 2026".
 */
export function rangeLabel({ start, end }: DateRange): string {
  if (start === end) return formatDate(start);
  const year = start.slice(0, 4);
  if (year !== end.slice(0, 4)) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start.slice(0, 7) === end.slice(0, 7)) return `${shortDate(start)}–${Number(end.slice(8))}, ${year}`;
  return `${shortDate(start)} – ${shortDate(end)}, ${year}`;
}

/** The name of the period a report compares with, e.g. "August 2026" or "Aug 1–27, 2026". */
export function comparisonLabel(period: Period): string {
  return period.kind === "custom" ? rangeLabel(period) : periodLabel(period);
}

/**
 * The name of the period before's stretch under one bar. A month or year
 * cut short where the period before ends is written out, e.g. "Jun 1–28, 2026".
 */
export function beforeBucketLabel(bucket: DateRange, unit: TimelineUnit): string {
  if (unit === "day" || unit === "week") return bucketLabel(bucket, unit);
  const whole = periodRange(periodContaining(unit, bucket.start));
  return whole.start === bucket.start && whole.end === bucket.end ? bucketLabel(bucket, unit) : rangeLabel(bucket);
}

/** How an amount changed from the period before. No percent when there was nothing before. */
export type Change = { direction: "up" | "down" | "same"; cents: number; percent: number | null };

export function compareAmounts(current: number, before: number): Change {
  const cents = Math.abs(current - before);
  const direction = current > before ? "up" : current < before ? "down" : "same";
  return { direction, cents, percent: before > 0 ? Math.round((cents / before) * 100) : null };
}

function percentText({ cents, percent }: Change): string {
  if (percent === null) return "";
  return percent === 0 && cents > 0 ? "<1%" : `${percent.toLocaleString()}%`;
}

/**
 * The change as a total shows it: "+$140.00" and "(21%)", "−$10.00" and
 * "(25%)", or "No change". Apart, so a narrow column can wrap between them.
 */
export function formatChange(change: Change): { amount: string; percent: string | null } {
  if (change.direction === "same") return { amount: "No change", percent: null };
  return {
    amount: `${change.direction === "up" ? "+" : "−"}${formatCents(change.cents)}`,
    percent: change.percent === null ? null : `(${percentText(change)})`,
  };
}

/** The change in words, for screen readers, e.g. "Up $140.00, 21%, from $680.00 in Q2 2026." */
export function changeSentence(current: number, before: number, label: string): string {
  const change = compareAmounts(current, before);
  const from = `${formatCents(before)} in ${label}.`;
  if (change.direction === "same") return `The same as ${from}`;
  const percent = change.percent === null ? "" : `, ${percentText(change)},`;
  return `${change.direction === "up" ? "Up" : "Down"} ${formatCents(change.cents)}${percent} from ${from}`;
}

import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { cn } from "cn";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trend, type DashboardSummary, type PaidKind, type Trend } from "@/lib/dashboard/summary";
import { periodLabel } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import {
  formatStorage,
  STORAGE_CRITICAL_PERCENT,
  STORAGE_LIMIT_BYTES,
  STORAGE_WARNING_PERCENT,
  storageUsage,
  type StorageLevel,
} from "@/lib/receipts/storage";

const KINDS: { kind: PaidKind; label: string; before: string }[] = [
  { kind: "month", label: "This month", before: "last month" },
  { kind: "quarter", label: "This quarter", before: "last quarter" },
  { kind: "year", label: "This year", before: "last year" },
];

function TrendIcon({ direction }: { direction: Trend["direction"] }) {
  const className = "size-3.5 shrink-0";
  if (direction === "up") return <TrendingUpIcon className={className} aria-hidden />;
  if (direction === "down") return <TrendingDownIcon className={className} aria-hidden />;
  return <MinusIcon className={className} aria-hidden />;
}

/** Paid so far in a period, and how that compares with the same point in the one before. */
function PaidCard({ summary, kind, label, before }: { summary: DashboardSummary; kind: PaidKind; before: string; label: string }) {
  const { period, cents } = summary.paid[kind];
  const earlier = summary.paidBefore[kind];
  const change = trend(cents, earlier);

  return (
    <Card size="sm" className="min-w-0 gap-2">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="truncate text-xl font-semibold tabular-nums">{formatCents(cents)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0.5 text-xs text-muted-foreground">
        <p className="truncate">{periodLabel(period)}</p>
        {change && (
          <p className="flex items-center gap-1">
            <TrendIcon direction={change.direction} />
            <span aria-hidden className="truncate">
              {change.direction === "same" ? "Same as" : `${change.percent}% vs.`} {before}
            </span>
            <span className="sr-only">
              {change.direction === "same"
                ? `About the same as ${formatCents(earlier)} at this point ${before}.`
                : `${change.direction === "up" ? "Up" : "Down"} ${change.percent}% from ${formatCents(earlier)} at this point ${before}.`}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const BAR_STYLES: Record<StorageLevel, string> = {
  ok: "bg-primary",
  warning: "bg-amber-500",
  critical: "bg-red-600 dark:bg-red-500",
};

const STORAGE_NOTES: Record<StorageLevel, { text: string; className?: string }> = {
  ok: { text: "of 1 GB free plan" },
  warning: { text: `Over ${STORAGE_WARNING_PERCENT}% full`, className: "text-amber-900 dark:text-amber-200" },
  critical: {
    text: `Over ${STORAGE_CRITICAL_PERCENT}% full. Past 1 GB, Supabase can limit the app.`,
    className: "text-red-700 dark:text-red-300",
  },
};

/** Receipt storage used against the 1 GB free plan, with warnings at 70% and 90%. */
function StorageCard({ bytes }: { bytes: number }) {
  const { percent, level } = storageUsage(bytes);
  // Keep a sliver visible once anything is stored.
  const width = bytes > 0 ? Math.min(100, Math.max(1, (bytes / STORAGE_LIMIT_BYTES) * 100)) : 0;
  const note = STORAGE_NOTES[level];

  return (
    <Card size="sm" className="min-w-0 gap-2">
      <CardHeader>
        <CardDescription id="storage-label">Receipt storage</CardDescription>
        <CardTitle className="truncate text-xl font-semibold tabular-nums">{formatStorage(bytes)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 text-xs text-muted-foreground">
        <div
          role="meter"
          aria-labelledby="storage-label"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(percent, 100)}
          aria-valuetext={`${percent}%, ${formatStorage(bytes)} of 1 GB`}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div className={cn("h-full rounded-full", BAR_STYLES[level])} style={{ width: `${width}%` }} />
        </div>
        <p className={cn(note.className)}>
          <span className="tabular-nums">{percent}%</span> {note.text}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Paid this month, quarter, and year, plus receipt storage. Two across on
 * phones, four on wider screens, and two again in the PC dashboard's column.
 */
export function StatCards({ summary }: { summary: DashboardSummary }) {
  return (
    <section aria-label="Totals" className="space-y-2">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 @4xl/main:grid-cols-2">
        {KINDS.map((item) => (
          <PaidCard key={item.kind} summary={summary} {...item} />
        ))}
        <StorageCard bytes={summary.storageBytes} />
      </div>
      <p className="text-xs text-muted-foreground">
        Paid totals go by the date paid. Changes compare with the same point last month, quarter, or year.
      </p>
    </section>
  );
}

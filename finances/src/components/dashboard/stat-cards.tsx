import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { cn } from "cn";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MoneyTotal } from "@/lib/dashboard/money";
import { trend, type DashboardSummary, type PaidKind, type Trend } from "@/lib/dashboard/summary";
import { periodLabel } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import {
  formatStorage,
  STORAGE_LIMIT_BYTES,
  storageUsage,
  type StorageLevel,
} from "@/lib/receipts/storage";

const KINDS: { kind: PaidKind; label: string; before: string }[] = [
  { kind: "month", label: "This month", before: "last month" },
  { kind: "quarter", label: "This quarter", before: "last quarter" },
  { kind: "year", label: "This year", before: "last year" },
];

/** An arrow for which way an amount went. Up isn't always good, so it has no color of its own. */
export function TrendIcon({ direction }: { direction: Trend["direction"] }) {
  const className = "size-3.5 shrink-0";
  if (direction === "up") return <TrendingUpIcon className={className} aria-hidden />;
  if (direction === "down") return <TrendingDownIcon className={className} aria-hidden />;
  return <MinusIcon className={className} aria-hidden />;
}

/** One amount, and how it compares with the same point in the period before. */
function Amount({ label, cents, earlier, before }: { label: string; cents: number; earlier: number; before: string }) {
  const change = trend(cents, earlier);

  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="space-y-0.5">
        <span className="block truncate text-base font-semibold tracking-tight tabular-nums @sm:text-lg">
          {formatCents(cents)}
        </span>
        {change && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendIcon direction={change.direction} />
            <span aria-hidden className="tabular-nums">
              {change.direction === "same" ? "Same" : `${change.percent}%`}
            </span>
            <span className="sr-only">
              {change.direction === "same"
                ? `About the same as ${formatCents(earlier)} at this point ${before}.`
                : `${change.direction === "up" ? "Up" : "Down"} ${change.percent}% from ${formatCents(earlier)} at this point ${before}.`}
            </span>
          </span>
        )}
      </dd>
    </div>
  );
}

/** Income, expenses, and profit so far in a period. */
function PeriodCard({ total, label, before }: { total: MoneyTotal; label: string; before: string }) {
  const { period, income, expenses, profit } = total;

  return (
    <Card size="sm" className="@container min-w-0 gap-2">
      <CardHeader>
        <CardTitle className="flex items-baseline justify-between gap-3">
          <h2>{label}</h2>
          <span className="min-w-0 truncate text-xs font-normal text-muted-foreground">{periodLabel(period)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-3 gap-2">
          <Amount label="Income" cents={income.total} earlier={total.before.income} before={before} />
          <Amount label="Expenses" cents={expenses} earlier={total.before.expenses} before={before} />
          <Amount label="Profit" cents={profit} earlier={total.before.profit} before={before} />
        </dl>
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
  ok: { text: "of the 1 GB free plan" },
  warning: { text: "of the 1 GB free plan. It's getting full.", className: "text-amber-900 dark:text-amber-200" },
  critical: {
    text: "of the 1 GB free plan. Past 1 GB, the free plan may limit the app.",
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
 * Income, expenses, and profit this month, quarter, and year, plus receipt
 * storage. One across on phones and in the PC dashboard's column, and two
 * between.
 */
export function StatCards({ summary }: { summary: DashboardSummary }) {
  return (
    <section aria-label="Totals" className="space-y-2">
      <div className="grid grid-cols-1 gap-3 @min-[45rem]/main:grid-cols-2 @4xl/main:grid-cols-1">
        {KINDS.map(({ kind, label, before }) => (
          <PeriodCard key={kind} total={summary.money[kind]} label={label} before={before} />
        ))}
        <StorageCard bytes={summary.storageBytes} />
      </div>
      <p className="text-xs text-muted-foreground">
        Expenses use the date paid. Changes compare with the same point last month, quarter, or year.
      </p>
    </section>
  );
}

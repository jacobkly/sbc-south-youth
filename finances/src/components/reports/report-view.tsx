"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DownloadIcon } from "lucide-react";
import { cn } from "cn";
import { TYPE_CHART_CONFIG } from "@/components/dashboard/chart-config";
import { PeriodPicker } from "@/components/reports/period-picker";
import { ReportList } from "@/components/reports/report-list";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { sharePercent } from "@/lib/dashboard/summary";
import { periodLabel, type IsoDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { REQUEST_TYPE_LABELS } from "@/lib/requests/format";
import type { ReportRow } from "@/lib/requests/queries";
import { REQUEST_TYPES } from "@/lib/requests/schema";
import {
  REPORT_BASES,
  REPORT_BASIS_LABELS,
  reportExportHref,
  reportHref,
  reportPayeeTotals,
  reportTotals,
  type PayeeTotals,
  type ReportBasis,
  type ReportFilters,
  type ReportTotals,
} from "@/lib/reports/filters";

const SELECTED = "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground hover:data-[state=on]:bg-primary/90";

function requestCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "request" : "requests"}`;
}

/** What the report counts, e.g. "Approved and paid, bought in Q3 2026". */
function reportSubject(filters: ReportFilters): string {
  const label = periodLabel(filters.period);
  const when = filters.period.kind === "custom" ? label : `in ${label}`;
  if (filters.basis === "paid") return `Paid ${when}`;
  return `${filters.allStatuses ? "All statuses" : "Approved and paid"}, bought ${when}`;
}

function emptyMessage(filters: ReportFilters): string {
  const label = periodLabel(filters.period);
  const when = filters.period.kind === "custom" ? label : `in ${label}`;
  if (filters.basis === "paid") return `Nothing paid ${when}.`;
  return `No ${filters.allStatuses ? "" : "approved or paid "}requests bought ${when}.`;
}

/**
 * The reports page. The period and filters live in the URL, so the back
 * button and shared links bring back the same report. The server loads
 * the rows; this shows each change right away while they load.
 */
export function ReportView({ filters, today, rows }: { filters: ReportFilters; today: IsoDate; rows: ReportRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(filters);

  function update(changes: Partial<ReportFilters>) {
    const next = { ...shown, ...changes };
    startTransition(() => {
      setShown(next);
      router.replace(reportHref(next), { scroll: false });
    });
  }

  const totals = reportTotals(rows);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        {/* A plain link, so the browser downloads the file itself. It exports the report being picked, even mid-load. */}
        <Button asChild variant="outline" className="h-11">
          <a href={reportExportHref(shown)} download>
            <DownloadIcon aria-hidden />
            Export CSV
          </a>
        </Button>
      </div>

      <section aria-label="Report options" className="@container space-y-4 rounded-lg border p-4">
        <PeriodPicker period={shown.period} today={today} onChange={(period) => update({ period })} />
        <div className="grid gap-4 @lg:grid-cols-2">
          <div className="space-y-2">
            <p id="report-basis-label" className="text-sm font-medium">
              Count by
            </p>
            <ToggleGroup
              type="single"
              variant="outline"
              spacing={0}
              value={shown.basis}
              onValueChange={(basis) => basis && update({ basis: basis as ReportBasis })}
              aria-labelledby="report-basis-label"
              className="w-full"
            >
              {REPORT_BASES.map((basis) => (
                <ToggleGroupItem key={basis} value={basis} className={`h-11 flex-1 px-2 ${SELECTED}`}>
                  {REPORT_BASIS_LABELS[basis]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="space-y-2">
            <p id="report-status-label" className="text-sm font-medium">
              Status
            </p>
            {shown.basis === "paid" ? (
              <p className="flex min-h-11 items-center text-sm text-muted-foreground">
                Only paid requests have a paid date.
              </p>
            ) : (
              <ToggleGroup
                type="single"
                variant="outline"
                spacing={0}
                value={shown.allStatuses ? "all" : "default"}
                onValueChange={(value) => value && update({ allStatuses: value === "all" })}
                aria-labelledby="report-status-label"
                className="w-full"
              >
                <ToggleGroupItem value="default" className={`h-11 flex-1 px-2 ${SELECTED}`}>
                  Approved and paid
                </ToggleGroupItem>
                <ToggleGroupItem value="all" className={`h-11 flex-1 px-2 ${SELECTED}`}>
                  All statuses
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          </div>
        </div>
      </section>

      <div aria-busy={pending} className={cn("space-y-6 transition-opacity", pending && "opacity-60")}>
        {rows.length > 0 ? (
          <>
            <TotalsSection totals={totals} subject={reportSubject(filters)} />
            <PayeeTotalsSection payees={reportPayeeTotals(rows)} totalCents={totals.cents} />
            <section aria-labelledby="report-requests-heading" className="space-y-3">
              <h2 id="report-requests-heading" className="text-lg font-semibold">
                Requests
              </h2>
              <ReportList
                rows={rows}
                basis={filters.basis}
                showStatus={filters.basis === "purchase"}
              />
            </section>
          </>
        ) : (
          <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            {emptyMessage(filters)}
          </p>
        )}
      </div>

      <p className="sr-only" role="status">
        {pending ? "" : `${requestCount(totals.count)}, ${formatCents(totals.cents)}`}
      </p>
    </div>
  );
}

/** Cafe, youth, and the total, one row each on a phone and side by side when there's room. */
function TotalsSection({ totals, subject }: { totals: ReportTotals; subject: string }) {
  return (
    <section aria-labelledby="report-totals-heading" className="@container space-y-3">
      <div>
        <h2 id="report-totals-heading" className="text-lg font-semibold">
          Totals
        </h2>
        <p className="text-sm text-muted-foreground">{subject}</p>
      </div>
      <dl className="grid divide-y rounded-lg border @md:grid-cols-3 @md:divide-x @md:divide-y-0">
        {REQUEST_TYPES.map((type) => (
          <div
            key={type}
            className="flex items-start justify-between gap-3 px-4 py-3 @md:flex-col @md:justify-start @md:gap-1"
          >
            <dt className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: TYPE_CHART_CONFIG[type].color }}
              />
              {REQUEST_TYPE_LABELS[type]}
            </dt>
            <dd className="text-right tabular-nums @md:text-left">
              <span className="block font-semibold">{formatCents(totals.byType[type].cents)}</span>
              <span className="block text-sm text-muted-foreground">
                {requestCount(totals.byType[type].count)} · {sharePercent(totals.byType[type].cents, totals.cents)}
              </span>
            </dd>
          </div>
        ))}
        <div className="flex items-start justify-between gap-3 px-4 py-3 @md:flex-col @md:justify-start @md:gap-1">
          <dt className="text-sm font-medium">Total</dt>
          <dd className="text-right tabular-nums @md:text-left">
            <span className="block font-semibold">{formatCents(totals.cents)}</span>
            <span className="block text-sm text-muted-foreground">{requestCount(totals.count)}</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}

/** How many payees a long list shows before "Show all". */
const PAYEES_SHOWN = 5;

/** Each payee's total and share, biggest first. A long list starts with the top few. */
function PayeeTotalsSection({ payees, totalCents }: { payees: PayeeTotals[]; totalCents: number }) {
  const [expanded, setExpanded] = useState(false);
  // Hiding only one or two payees would save less than the button takes.
  const collapsible = payees.length > PAYEES_SHOWN + 2;
  const shown = collapsible && !expanded ? payees.slice(0, PAYEES_SHOWN) : payees;

  return (
    <section aria-labelledby="report-payees-heading" className="space-y-3">
      <h2 id="report-payees-heading" className="text-lg font-semibold">
        By payee
      </h2>
      <dl id="report-payee-totals" className="divide-y rounded-lg border">
        {shown.map((payee) => (
          <div key={payee.payeeId} className="flex items-start justify-between gap-3 px-4 py-3">
            <dt className="min-w-0 truncate text-sm font-medium">{payee.name}</dt>
            <dd className="shrink-0 text-right tabular-nums">
              <span className="block font-semibold">{formatCents(payee.cents)}</span>
              <span className="block text-sm text-muted-foreground">
                {requestCount(payee.count)} · {sharePercent(payee.cents, totalCents)}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      {collapsible && (
        <Button
          variant="outline"
          className="h-11 w-full"
          aria-controls="report-payee-totals"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? `Show the top ${PAYEES_SHOWN}` : `Show all ${payees.length} payees`}
        </Button>
      )}
    </section>
  );
}

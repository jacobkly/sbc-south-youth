"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import { TYPE_CHART_CONFIG } from "@/components/dashboard/chart-config";
import { ExportMenu } from "@/components/reports/export-menu";
import { PeriodPicker } from "@/components/reports/period-picker";
import { ReportChart } from "@/components/reports/report-chart";
import { ReportList } from "@/components/reports/report-list";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { sharePercent } from "@/lib/dashboard/summary";
import { periodLabel, periodRange, type IsoDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { pageCount, pageItems, pageSlice } from "@/lib/pagination";
import { REQUEST_TYPE_LABELS } from "@/lib/requests/format";
import type { ReportRow } from "@/lib/requests/queries";
import { REQUEST_TYPES } from "@/lib/requests/schema";
import {
  REPORT_BASES,
  REPORT_BASIS_LABELS,
  REPORT_PAGE_SIZE,
  reportHref,
  reportPageHref,
  reportPayeeTotals,
  reportTotals,
  type PayeeTotals,
  type ReportBasis,
  type ReportFilters,
  type ReportTotals,
} from "@/lib/reports/filters";
import { reportTimeline } from "@/lib/reports/timeline";

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
export function ReportView({
  filters,
  page,
  today,
  rows,
}: {
  filters: ReportFilters;
  /** Which page of requests to show. */
  page: number;
  today: IsoDate;
  rows: ReportRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(filters);

  /** Leaves the page out of the URL, so a new report starts from the first page. */
  function update(changes: Partial<ReportFilters>) {
    const next = { ...shown, ...changes };
    startTransition(() => {
      setShown(next);
      router.replace(reportHref(next), { scroll: false });
    });
  }

  const totals = reportTotals(rows);
  const timeline = reportTimeline(rows, periodRange(filters.period), filters.basis);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <ExportMenu filters={shown} report={{ filters, rows }} loading={pending} />
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

      {/*
        On a PC the totals and chart sit left of the payees, above the
        full-width requests. Equal columns give the totals room to go across,
        so the left side comes out about as tall as five payees.
      */}
      <div
        aria-busy={pending}
        className={cn(
          "grid grid-cols-1 gap-6 transition-opacity @4xl/main:grid-cols-2 @4xl/main:items-start",
          pending && "opacity-60",
        )}
      >
        {rows.length > 0 ? (
          <>
            <div className="space-y-6">
              <TotalsSection totals={totals} subject={reportSubject(filters)} />
              {/* A one-day report would be a single bar. */}
              {timeline.buckets.length > 1 && <ReportChart timeline={timeline} />}
            </div>
            <PayeeTotalsSection payees={reportPayeeTotals(rows)} totalCents={totals.cents} />
            <RequestsSection rows={rows} filters={filters} page={page} disabled={pending} />
          </>
        ) : (
          <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground @4xl/main:col-span-2">
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

/**
 * The report's requests, a page at a time. The page is kept in the URL, so
 * coming back from a request brings back the same page.
 */
function RequestsSection({
  rows,
  filters,
  page: loadedPage,
  disabled,
}: {
  rows: ReportRow[];
  filters: ReportFilters;
  page: number;
  disabled: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Every row is already here, so the page changes right away while the URL catches up.
  const [page, setPage] = useOptimistic(loadedPage);
  const { page: current, items: shown, first, last } = pageSlice(rows, page, REPORT_PAGE_SIZE);
  const count = pageCount(rows.length, REPORT_PAGE_SIZE);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  // A new page starts from the top of the list, with focus on its heading.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    const top = heading.current;
    if (!top) return;
    if (top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: "start" });
    top.focus({ preventScroll: true });
  }, [current]);

  // Through the router, not history.replaceState, so Next knows the page's URL.
  // Otherwise refreshing the page after going back to it would scroll to the top.
  function goTo(next: number) {
    if (next === current) return;
    moved.current = true;
    startTransition(() => {
      setPage(next);
      router.replace(reportPageHref(filters, next), { scroll: false });
    });
  }

  return (
    <section aria-labelledby="report-requests-heading" className="space-y-3 @4xl/main:col-span-2">
      <h2
        ref={heading}
        id="report-requests-heading"
        tabIndex={-1}
        className="scroll-mt-4 text-lg font-semibold outline-none"
      >
        Requests
      </h2>
      <ReportList id="report-requests" rows={shown} basis={filters.basis} showStatus={filters.basis === "purchase"} />
      {count > 1 && (
        <>
          <p className="text-center text-sm text-muted-foreground tabular-nums">
            Showing {first.toLocaleString()}–{last.toLocaleString()} of {rows.length.toLocaleString()}
          </p>
          {/* A phone gets previous and next. A wider list shows the page numbers between them. */}
          <nav aria-label="Pages of requests" className="@container">
            <div className="flex items-center justify-between gap-2 @md:justify-center">
              <Button
                variant="outline"
                className="h-11 px-3 @md:w-11 @md:px-0"
                aria-controls="report-requests"
                disabled={disabled || current === 1}
                onClick={() => goTo(current - 1)}
              >
                <ChevronLeftIcon aria-hidden />
                <span className="@md:sr-only">Previous</span>
              </Button>
              <p className="text-sm tabular-nums @md:hidden">
                Page {current} of {count}
              </p>
              <ul className="hidden items-center gap-1 @md:flex">
                {pageItems(current, count).map((item, index) =>
                  item === "gap" ? (
                    <li key={`gap-${index}`} aria-hidden className="w-11 text-center text-muted-foreground">
                      …
                    </li>
                  ) : (
                    <li key={item}>
                      <Button
                        variant={item === current ? "default" : "ghost"}
                        className="size-11 tabular-nums"
                        aria-label={`Page ${item}`}
                        aria-current={item === current ? "page" : undefined}
                        aria-controls="report-requests"
                        disabled={disabled}
                        onClick={() => goTo(item)}
                      >
                        {item}
                      </Button>
                    </li>
                  ),
                )}
              </ul>
              <Button
                variant="outline"
                className="h-11 px-3 @md:w-11 @md:px-0"
                aria-controls="report-requests"
                disabled={disabled || current === count}
                onClick={() => goTo(current + 1)}
              >
                <span className="@md:sr-only">Next</span>
                <ChevronRightIcon aria-hidden />
              </Button>
            </div>
          </nav>
        </>
      )}
    </section>
  );
}

/** How many payees a long list shows before "Show all". */
const PAYEES_SHOWN = 5;

/**
 * Each payee's total and share, biggest first, linking to the payee.
 * A long list starts with the top few.
 */
function PayeeTotalsSection({ payees, totalCents }: { payees: PayeeTotals[]; totalCents: number }) {
  const [expanded, setExpanded] = useState(false);
  // Hiding only one or two payees would save less than the button takes.
  const collapsible = payees.length > PAYEES_SHOWN + 2;
  const shown = collapsible && !expanded ? payees.slice(0, PAYEES_SHOWN) : payees;

  return (
    <section aria-labelledby="report-payees-heading" className="space-y-3">
      <div>
        <h2 id="report-payees-heading" className="text-lg font-semibold">
          By payee
        </h2>
        <p className="text-sm text-muted-foreground">
          {payees.length.toLocaleString()} {payees.length === 1 ? "payee" : "payees"}, most paid first
        </p>
      </div>
      <ul id="report-payee-totals" className="divide-y rounded-lg border">
        {shown.map((payee) => (
          <li key={payee.payeeId}>
            <Link
              href={`/admin/payees/${payee.payeeId}`}
              className="flex items-start justify-between gap-3 px-4 py-3 outline-none hover:bg-muted focus-visible:bg-muted"
            >
              <span className="min-w-0 truncate text-sm font-medium">{payee.name}</span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="block font-semibold">{formatCents(payee.cents)}</span>
                <span className="block text-sm text-muted-foreground">
                  {requestCount(payee.count)} · {sharePercent(payee.cents, totalCents)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
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

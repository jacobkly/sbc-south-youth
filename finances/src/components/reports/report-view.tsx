"use client";

import { useEffect, useOptimistic, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import { TYPE_CHART_CONFIG } from "@/components/dashboard/chart-config";
import { TrendIcon } from "@/components/dashboard/stat-cards";
import { ExportMenu } from "@/components/reports/export-menu";
import { PayeeBreakdowns } from "@/components/reports/payee-breakdowns";
import { PeriodPicker } from "@/components/reports/period-picker";
import { ReportChart } from "@/components/reports/report-chart";
import { ReportList } from "@/components/reports/report-list";
import { RequestBreakdowns } from "@/components/reports/request-breakdowns";
import { RunningTotalChart } from "@/components/reports/running-total-chart";
import { TimingBreakdowns } from "@/components/reports/timing-breakdowns";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { sharePercent } from "@/lib/dashboard/summary";
import { periodLabel, periodRange, type IsoDate, type Period } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { pageCount, pageItems, pageSlice } from "@/lib/pagination";
import { REQUEST_TYPE_LABELS } from "@/lib/requests/format";
import type { ReportRow } from "@/lib/requests/queries";
import { REQUEST_TYPES } from "@/lib/requests/schema";
import { changeSentence, compareAmounts, comparisonLabel, formatChange } from "@/lib/reports/comparison";
import {
  REPORT_BASES,
  REPORT_BASIS_LABELS,
  REPORT_PAGE_SIZE,
  REPORT_TAB_LABELS,
  REPORT_TABS,
  reportHref,
  reportPayeeTotals,
  reportTotals,
  type ReportBasis,
  type ReportFilters,
  type ReportTab,
  type ReportTotals,
} from "@/lib/reports/filters";
import { reportTimeline, timelineBefore, type TimelineRow } from "@/lib/reports/timeline";

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
  return `No ${filters.allStatuses ? "" : "approved or paid "}purchases ${when}.`;
}

/** The period a report compares with, and its requests. */
export type ReportBefore = { period: Period; rows: TimelineRow[] };

/** The period before's name and totals, for the changes under each total. */
type Comparison = { label: string; totals: ReportTotals };

/**
 * The reports page. The period, filters, and open tab live in the URL, so
 * the back button and shared links bring back the same report. The server
 * loads the rows; this shows each change right away while they load.
 */
export function ReportView({
  filters,
  tab,
  page,
  today,
  rows,
  before,
  returning,
}: {
  filters: ReportFilters;
  tab: ReportTab;
  /** Which page of requests to show. */
  page: number;
  today: IsoDate;
  rows: ReportRow[];
  before: ReportBefore;
  /** Payees with a request the report would count from before its period. */
  returning: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(filters);
  // Apart from the filters, so switching tabs doesn't dim the report while the URL catches up.
  const [, startTabTransition] = useTransition();
  const [shownTab, setShownTab] = useOptimistic(tab);

  /** Keeps the tab but leaves out the page, so a new report starts from the first page. */
  function update(changes: Partial<ReportFilters>) {
    const next = { ...shown, ...changes };
    startTransition(() => {
      setShown(next);
      router.replace(reportHref(next, { tab: shownTab }), { scroll: false });
    });
  }

  function openTab(next: ReportTab) {
    startTabTransition(() => {
      setShownTab(next);
      router.replace(reportHref(shown, { tab: next }), { scroll: false });
    });
  }

  const range = periodRange(filters.period);
  const totals = reportTotals(rows);
  const timeline = reportTimeline(rows, range, filters.basis);
  const comparison: Comparison = { label: comparisonLabel(before.period), totals: reportTotals(before.rows) };
  const beforeBuckets =
    comparison.totals.count > 0
      ? timelineBefore(timeline, range, { range: periodRange(before.period), rows: before.rows }, filters.basis)
      : null;
  const chartBefore = beforeBuckets && { label: comparison.label, buckets: beforeBuckets };

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

      {/* The filters above apply to every tab. */}
      <Tabs value={shownTab} onValueChange={(value) => openTab(value as ReportTab)} className="gap-4">
        <TabsList className="w-full group-data-horizontal/tabs:h-10 @4xl/main:w-96 @4xl/main:group-data-horizontal/tabs:h-11">
          {REPORT_TABS.map((value) => (
            <TabsTrigger key={value} value={value}>
              {REPORT_TAB_LABELS[value]}
            </TabsTrigger>
          ))}
        </TabsList>
        <div aria-busy={pending} className={cn("transition-opacity", pending && "opacity-60")}>
          <TabsContent value="overview" className="space-y-6 text-base">
            {rows.length > 0 ? (
              <>
                <TotalsSection totals={totals} subject={reportSubject(filters)} comparison={comparison} />
                {/* A one-day report would be a single bar. */}
                {timeline.buckets.length > 1 && (
                  <>
                    <ReportChart timeline={timeline} before={chartBefore} />
                    <RunningTotalChart
                      timeline={timeline}
                      before={chartBefore && { ...chartBefore, cents: comparison.totals.cents }}
                      label={comparisonLabel(filters.period)}
                      today={today}
                      running={range.end > today}
                    />
                  </>
                )}
              </>
            ) : (
              <EmptyReport filters={filters} />
            )}
          </TabsContent>
          <TabsContent value="requests" className="space-y-6 text-base">
            {rows.length > 0 ? (
              <>
                <RequestBreakdowns rows={rows} filters={filters} />
                <RequestsSection rows={rows} filters={filters} page={page} disabled={pending} />
              </>
            ) : (
              <EmptyReport filters={filters} />
            )}
          </TabsContent>
          <TabsContent value="payees" className="text-base">
            {rows.length > 0 ? (
              <PayeeBreakdowns
                payees={reportPayeeTotals(rows)}
                totals={totals}
                returning={new Set(returning)}
                filters={filters}
              />
            ) : (
              <EmptyReport filters={filters} />
            )}
          </TabsContent>
          <TabsContent value="timing" className="text-base">
            {rows.length > 0 ? (
              <TimingBreakdowns rows={rows} timeline={timeline} filters={filters} />
            ) : (
              <EmptyReport filters={filters} />
            )}
          </TabsContent>
        </div>
      </Tabs>

      <p className="sr-only" role="status">
        {pending ? "" : `${requestCount(totals.count)}, ${formatCents(totals.cents)}`}
      </p>
    </div>
  );
}

function EmptyReport({ filters }: { filters: ReportFilters }) {
  return (
    <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
      {emptyMessage(filters)}
    </p>
  );
}

/** How an amount changed from the period before, with an arrow and, for screen readers, in words. */
function ChangeLine({ current, before, label }: { current: number; before: number; label: string }) {
  const change = compareAmounts(current, before);
  const { amount, percent } = formatChange(change);
  return (
    <span className="flex flex-wrap items-center justify-end gap-x-1 text-sm text-muted-foreground @md:justify-start">
      <span aria-hidden className="flex items-center gap-1 whitespace-nowrap">
        <TrendIcon direction={change.direction} />
        {amount}
      </span>
      {percent && (
        <span aria-hidden className="whitespace-nowrap">
          {percent}
        </span>
      )}
      <span className="sr-only">{changeSentence(current, before, label)}</span>
    </span>
  );
}

/**
 * Cafe, youth, and the total, one row each on a phone and side by side when
 * there's room. Each shows how it changed from the period before.
 */
function TotalsSection({ totals, subject, comparison }: { totals: ReportTotals; subject: string; comparison: Comparison }) {
  const compared = comparison.totals.count > 0;
  return (
    <section aria-labelledby="report-totals-heading" className="@container space-y-3">
      <div>
        <h2 id="report-totals-heading" className="text-lg font-semibold">
          Totals
        </h2>
        <p className="text-sm text-muted-foreground">{subject}</p>
        <p className="text-sm text-muted-foreground">
          {compared ? `Compared with ${comparison.label}` : `No requests in ${comparison.label} to compare with`}
        </p>
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
              {compared && (
                <ChangeLine
                  current={totals.byType[type].cents}
                  before={comparison.totals.byType[type].cents}
                  label={comparison.label}
                />
              )}
            </dd>
          </div>
        ))}
        <div className="flex items-start justify-between gap-3 px-4 py-3 @md:flex-col @md:justify-start @md:gap-1">
          <dt className="text-sm font-medium">Total</dt>
          <dd className="text-right tabular-nums @md:text-left">
            <span className="block font-semibold">{formatCents(totals.cents)}</span>
            <span className="block text-sm text-muted-foreground">{requestCount(totals.count)}</span>
            {compared && <ChangeLine current={totals.cents} before={comparison.totals.cents} label={comparison.label} />}
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
      router.replace(reportHref(filters, { tab: "requests", page: next }), { scroll: false });
    });
  }

  return (
    <section aria-labelledby="report-requests-heading" className="space-y-3">
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

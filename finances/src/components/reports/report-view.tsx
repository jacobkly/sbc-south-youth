"use client";

import { useEffect, useOptimistic, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import { requestCount } from "@/components/reports/breakdown";
import { ExportMenu } from "@/components/reports/export-menu";
import { IncomeReport } from "@/components/reports/income-report";
import { OverviewReport, type ReportBefore } from "@/components/reports/overview-report";
import { PayeeBreakdowns } from "@/components/reports/payee-breakdowns";
import { PeriodPicker } from "@/components/reports/period-picker";
import { ReportList } from "@/components/reports/report-list";
import { RequestBreakdowns } from "@/components/reports/request-breakdowns";
import { TimingBreakdowns } from "@/components/reports/timing-breakdowns";
import { within } from "@/components/reports/totals";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { periodRange, type IsoDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { pageCount, pageItems, pageSlice } from "@/lib/pagination";
import type { ReportRow } from "@/lib/requests/queries";
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
} from "@/lib/reports/filters";
import { incomeTotals, type ReportIncome } from "@/lib/reports/income";
import { reportTimeline } from "@/lib/reports/timeline";

const SELECTED = "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground hover:data-[state=on]:bg-primary/90";

/** What the report counts, e.g. "Approved and paid, bought in Q3 2026". */
function reportSubject(filters: ReportFilters): string {
  const when = within(filters.period);
  if (filters.basis === "paid") return `Paid ${when}`;
  return `${filters.allStatuses ? "All statuses" : "Approved and paid"}, bought ${when}`;
}

function emptyMessage(filters: ReportFilters): string {
  const when = within(filters.period);
  if (filters.basis === "paid") return `Nothing paid ${when}.`;
  return `No ${filters.allStatuses ? "" : "approved or paid "}purchases ${when}.`;
}

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
  income,
  before,
  returning,
}: {
  filters: ReportFilters;
  tab: ReportTab;
  /** Which page of requests to show. */
  page: number;
  today: IsoDate;
  rows: ReportRow[];
  /** Tithes, events, cafe weeks, and church paybacks in the period. */
  income: ReportIncome;
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
  const money = incomeTotals(income, rows);
  const timeline = reportTimeline(rows, range, filters.basis);

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
          <TabsContent value="overview" className="text-base">
            <OverviewReport
              filters={filters}
              income={income}
              rows={rows}
              before={before}
              timeline={timeline}
              today={today}
            />
          </TabsContent>
          <TabsContent value="income" className="text-base">
            <IncomeReport filters={filters} income={income} rows={rows} before={before} />
          </TabsContent>
          <TabsContent value="requests" className="space-y-6 text-base">
            {rows.length > 0 ? (
              <>
                <TabNote filters={filters} count={totals.count} cents={totals.cents} />
                <RequestBreakdowns rows={rows} filters={filters} />
                <RequestsSection rows={rows} filters={filters} page={page} disabled={pending} />
              </>
            ) : (
              <EmptyReport filters={filters} />
            )}
          </TabsContent>
          <TabsContent value="payees" className="space-y-6 text-base">
            {rows.length > 0 ? (
              <>
                <TabNote filters={filters} count={totals.count} cents={totals.cents} />
                <PayeeBreakdowns
                  payees={reportPayeeTotals(rows)}
                  totals={totals}
                  returning={new Set(returning)}
                  filters={filters}
                />
              </>
            ) : (
              <EmptyReport filters={filters} />
            )}
          </TabsContent>
          <TabsContent value="timing" className="space-y-6 text-base">
            {rows.length > 0 ? (
              <>
                <TabNote filters={filters} count={totals.count} cents={totals.cents} />
                <TimingBreakdowns rows={rows} timeline={timeline} filters={filters} />
              </>
            ) : (
              <EmptyReport filters={filters} />
            )}
          </TabsContent>
        </div>
      </Tabs>

      <p className="sr-only" role="status">
        {pending
          ? ""
          : `Income ${formatCents(money.income.total)}, expenses ${formatCents(money.out.total)}, profit ${formatCents(money.profit.total)}`}
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

/** What a tab about requests counts, since these tabs leave income out. */
function TabNote({ filters, count, cents }: { filters: ReportFilters; count: number; cents: number }) {
  const everyStatus = filters.allStatuses && filters.basis === "purchase";
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{everyStatus ? "Requests only" : "Expenses only"}.</span>{" "}
      {reportSubject(filters)} · {requestCount(count)}, {formatCents(cents)}
    </p>
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

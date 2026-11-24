import { TYPE_CHART_CONFIG } from "@/components/dashboard/chart-config";
import { requestCount } from "@/components/reports/breakdown";
import { ChangeLine } from "@/components/reports/change-line";
import { IncomeExpenseChart } from "@/components/reports/income-expense-chart";
import { ReportChart } from "@/components/reports/report-chart";
import { RunningTotalChart } from "@/components/reports/running-total-chart";
import { Cell, Cells, Heading, within } from "@/components/reports/totals";
import { sharePercent } from "@/lib/dashboard/summary";
import { periodLabel, periodRange, type IsoDate, type Period } from "@/lib/dates";
import { youthSummary } from "@/lib/income/stats";
import { formatCents } from "@/lib/money";
import { REQUEST_TYPE_LABELS, type RequestStatus } from "@/lib/requests/format";
import { REQUEST_TYPES } from "@/lib/requests/schema";
import { comparisonLabel } from "@/lib/reports/comparison";
import { reportTotals, type ReportFilters } from "@/lib/reports/filters";
import { hasMoney, incomeTotals, wasSpent, type ReportIncome } from "@/lib/reports/income";
import { profitTimeline } from "@/lib/reports/profit";
import { timelineBefore, type Timeline, type TimelineRow } from "@/lib/reports/timeline";

type Row = TimelineRow & { status: RequestStatus };

/** The period a report compares with, its requests, and its income. */
export type ReportBefore = { period: Period; rows: Row[]; income: ReportIncome };

/**
 * The Overview: the period's income, expenses, and profit, then the same for
 * the cafe and youth, then how they moved through the period. Income counts
 * by the day it came in, or the Sunday a cafe week ends, whatever the
 * requests are counted by.
 */
export function OverviewReport({
  filters,
  income,
  rows,
  before,
  timeline,
  today,
}: {
  filters: ReportFilters;
  income: ReportIncome;
  rows: readonly Row[];
  before: ReportBefore;
  /** The requests over the period. */
  timeline: Timeline;
  today: IsoDate;
}) {
  const when = within(filters.period);
  const totals = incomeTotals(income, rows);
  if (!hasMoney(totals) && rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        Nothing came in or went out {when}.
      </p>
    );
  }

  const byPaidDate = filters.basis === "paid";
  const everyStatus = filters.allStatuses && !byPaidDate;
  const spent = reportTotals(rows.filter(wasSpent));
  const youth = youthSummary(income.youth);

  const beforeTotals = incomeTotals(before.income, before.rows);
  const beforeLabel = comparisonLabel(before.period);
  const compared = hasMoney(beforeTotals);
  const change = (current: number, earlier: number) =>
    compared ? <ChangeLine current={current} before={earlier} label={beforeLabel} /> : undefined;

  const cafeIncome = [
    `Square ${formatCents(totals.income.square)}`,
    totals.income.discounts > 0 && `discounts ${formatCents(totals.income.discounts)}`,
    totals.income.giftCards > 0 && `gift cards ${formatCents(totals.income.giftCards)}`,
  ].filter(Boolean);
  const incomeDetail = {
    cafe: cafeIncome.length > 1 ? cafeIncome.join(" · ") : "From Square",
    youth: `Tithes ${formatCents(youth.tithes.total)} · events ${formatCents(youth.events.total)}`,
  };

  const range = periodRange(filters.period);
  const beforeRequests = reportTotals(before.rows);
  const beforeBuckets =
    beforeRequests.count > 0
      ? timelineBefore(timeline, range, { range: periodRange(before.period), rows: before.rows }, filters.basis)
      : null;
  const chartBefore = beforeBuckets && { label: beforeLabel, buckets: beforeBuckets };
  const profit = profitTimeline(income, rows, range, filters.basis);
  // With every status showing, the bars are requests, not just what was spent.
  const noun = everyStatus ? "Requests" : "Expenses";

  return (
    <div className="space-y-6">
      <section aria-labelledby="report-totals-heading" className="@container space-y-3">
        <Heading id="report-totals-heading" title="Income, expenses, and profit">
          <p className="text-sm text-muted-foreground">
            {periodLabel(filters.period)} · Expenses by {byPaidDate ? "date paid" : "purchase date, approved and paid"}
          </p>
          {everyStatus && (
            <p className="text-sm text-muted-foreground">Other statuses weren&apos;t spent, so they stay out here.</p>
          )}
          <p className="text-sm text-muted-foreground">
            {compared ? `Compared with ${beforeLabel}` : `Nothing in ${beforeLabel} to compare with`}
          </p>
        </Heading>
        <Cells>
          <Cell
            size="lg"
            label="Income"
            cents={totals.income.total}
            detail={`Cafe ${formatCents(totals.income.cafe)} · Youth ${formatCents(totals.income.youth)}`}
            change={change(totals.income.total, beforeTotals.income.total)}
          />
          <Cell
            size="lg"
            label="Expenses"
            cents={totals.out.total}
            detail={requestCount(totals.out.count)}
            change={change(totals.out.total, beforeTotals.out.total)}
          />
          <Cell
            size="lg"
            label="Profit"
            cents={totals.profit.total}
            detail={totals.profit.total < 0 ? "More was spent than came in" : "Income minus expenses"}
            change={change(totals.profit.total, beforeTotals.profit.total)}
          />
        </Cells>
        {cafeIncome.length > 1 && (
          <p className="text-sm text-muted-foreground">
            Cafe discounts count as income the week they&apos;re given, since the church pays them back. Gift card
            money counts when it comes in.
          </p>
        )}
      </section>

      <section aria-labelledby="report-types-heading" className="space-y-3">
        <Heading id="report-types-heading" title="Cafe and youth">
          <p className="text-sm text-muted-foreground">Each one&apos;s income, minus its own expenses</p>
        </Heading>
        <div className="grid gap-3 @4xl/main:grid-cols-2">
          {REQUEST_TYPES.map((type) => (
            <section key={type} aria-labelledby={`report-${type}-heading`} className="@container space-y-2">
              <h3 id={`report-${type}-heading`} className="flex items-center gap-2 text-sm font-medium">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: TYPE_CHART_CONFIG[type].color }}
                />
                {REQUEST_TYPE_LABELS[type]}
              </h3>
              <Cells>
                <Cell
                  label="Income"
                  cents={totals.income[type]}
                  detail={incomeDetail[type]}
                  change={change(totals.income[type], beforeTotals.income[type])}
                />
                <Cell
                  label="Expenses"
                  cents={totals.out[type]}
                  detail={
                    spent.byType[type].count > 0
                      ? `${requestCount(spent.byType[type].count)} · ${sharePercent(totals.out[type], totals.out.total)} of all`
                      : requestCount(0)
                  }
                  change={change(totals.out[type], beforeTotals.out[type])}
                />
                <Cell
                  label="Profit"
                  cents={totals.profit[type]}
                  change={change(totals.profit[type], beforeTotals.profit[type])}
                />
              </Cells>
            </section>
          ))}
        </div>
      </section>

      {/* A one-day report would be a single bar. */}
      {profit.buckets.length > 1 && <IncomeExpenseChart timeline={profit} />}
      {rows.length > 0 && timeline.buckets.length > 1 && (
        <>
          <ReportChart timeline={timeline} before={chartBefore} noun={noun} />
          <RunningTotalChart
            timeline={timeline}
            before={chartBefore && { ...chartBefore, cents: beforeRequests.cents }}
            label={comparisonLabel(filters.period)}
            noun={noun}
            today={today}
            running={range.end > today}
          />
        </>
      )}
    </div>
  );
}

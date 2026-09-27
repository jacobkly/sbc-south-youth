"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, type XAxisTickContentProps } from "recharts";
import { Breakdown, labeled, requestCount } from "@/components/reports/breakdown";
import { BucketTick, ChartNumbers, UNIT_COLUMNS } from "@/components/reports/report-chart";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { ReportFilters } from "@/lib/reports/filters";
import { bucketLabel, bucketTick, type Timeline, type TimelineUnit } from "@/lib/reports/timeline";
import {
  DAY_BAND_LABELS,
  formatDays,
  paidDaysBreakdown,
  paidDaysTimeline,
  waits,
  type TimingRow,
  type Wait,
  type Waits,
} from "@/lib/reports/timing";

const STEPS = [
  { key: "boughtToPaid", label: "Bought to paid", none: "Nothing paid yet" },
  { key: "submittedToApproved", label: "Submitted to approved", none: "None yet" },
  { key: "approvedToPaid", label: "Approved to paid", none: "None yet" },
] as const satisfies readonly { key: keyof Waits; label: string; none: string }[];

/**
 * The Timing tab: how long requests wait at each step, how many days paid
 * requests took, and how that changed over the report's period.
 */
export function TimingBreakdowns({
  rows,
  timeline,
  filters,
}: {
  rows: TimingRow[];
  timeline: Timeline;
  filters: ReportFilters;
}) {
  const result = waits(rows);
  const paid = result.boughtToPaid.count;
  return (
    <div className="space-y-6">
      <WaitsSection waits={result} />
      <div className="grid gap-6 @4xl/main:grid-cols-2 @4xl/main:items-start">
        <Breakdown
          id="report-paid-days"
          title="Days to get paid"
          description="Paid requests, by the days from purchase to paid"
          items={paid > 0 ? labeled(paidDaysBreakdown(rows), DAY_BAND_LABELS) : []}
          by="count"
          empty={
            result.imported > 0
              ? "Only imported requests have been paid, and they're left out."
              : "Nothing in this report has been paid yet."
          }
        />
        <PaidDaysChart rows={rows} timeline={timeline} filters={filters} />
      </div>
    </div>
  );
}

function waitDetail(wait: Wait, none: string): string {
  if (wait.count === 0) return none;
  if (wait.count === 1) return requestCount(1);
  return `Median of ${requestCount(wait.count)}`;
}

/** The longest wait, when there's more than one to be longest. */
function longestDetail(wait: Wait): string | null {
  if (wait.count < 2 || wait.longest === null) return null;
  return wait.longest === 0 ? "All the same day" : `Longest ${formatDays(wait.longest)}`;
}

/** The median wait at each step, one row each on a phone and side by side when there's room. */
function WaitsSection({ waits }: { waits: Waits }) {
  return (
    <section aria-labelledby="report-waits-heading" className="@container space-y-3">
      <div>
        <h2 id="report-waits-heading" className="text-lg font-semibold">
          How long it takes
        </h2>
        <p className="text-sm text-muted-foreground">Median days: half took this long or less</p>
        {waits.imported > 0 && (
          <p className="text-sm text-muted-foreground">
            {waits.imported === 1 ? "1 imported request is" : `${waits.imported.toLocaleString()} imported requests are`}{" "}
            left out, since the spreadsheet had one date for purchase and payment.
          </p>
        )}
      </div>
      <dl className="grid divide-y rounded-lg border @md:grid-cols-3 @md:divide-x @md:divide-y-0">
        {STEPS.map(({ key, label, none }) => {
          const wait = waits[key];
          const longest = longestDetail(wait);
          return (
            <div
              key={key}
              className="flex items-start justify-between gap-3 px-4 py-3 @md:flex-col @md:justify-start @md:gap-1"
            >
              <dt className="text-sm">{label}</dt>
              <dd className="text-right tabular-nums @md:text-left">
                <span className="block font-semibold">
                  {wait.median === null ? <span aria-hidden>—</span> : formatDays(wait.median)}
                </span>
                <span className="block text-sm text-muted-foreground">{waitDetail(wait, none)}</span>
                {longest && <span className="block text-sm text-muted-foreground">{longest}</span>}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

const UNIT_HEADINGS: Record<TimelineUnit, string> = {
  day: "Days to get paid, by day",
  week: "Days to get paid, by week",
  month: "Days to get paid, by month",
  year: "Days to get paid, by year",
};

const CHART_CONFIG = {
  median: { label: "Median days", color: "var(--primary)" },
} satisfies ChartConfig;

type ChartRow = { key: string; tick: string; label: string; median: number | null; count: number };

/**
 * The median days to get paid in each of the report's days, weeks, months,
 * or years. Only drawn when at least two of them have paid requests.
 */
function PaidDaysChart({ rows, timeline, filters }: { rows: TimingRow[]; timeline: Timeline; filters: ReportFilters }) {
  const { unit, buckets } = timeline;
  const chartRows: ChartRow[] = paidDaysTimeline(rows, timeline, filters.basis).map((bucket, index) => ({
    key: buckets[index].start,
    tick: bucketTick(buckets[index], unit),
    label: bucketLabel(buckets[index], unit),
    ...bucket,
  }));
  const filled = chartRows.filter((row) => row.count > 0);
  if (filled.length < 2) return null;
  const title = UNIT_HEADINGS[unit];

  return (
    <section aria-labelledby="report-paid-days-chart-heading" className="space-y-3">
      <div>
        <h2 id="report-paid-days-chart-heading" className="text-lg font-semibold">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">
          Median for requests {filters.basis === "paid" ? "paid" : "bought"} each {unit}
        </p>
      </div>
      <div className="rounded-lg border">
        {/* Pointer and touch only. "Show the numbers" has the same data for everyone. */}
        <div aria-hidden className="px-2 pt-4">
          <ChartContainer config={CHART_CONFIG} className="aspect-auto h-48 w-full @4xl/main:h-64">
            <BarChart data={chartRows} accessibilityLayer={false} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="tick"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={0}
                tick={(props: XAxisTickContentProps) => <BucketTick {...props} unit={unit} />}
              />
              <YAxis
                width="auto"
                tickLine={false}
                axisLine={false}
                tickCount={4}
                allowDecimals={false}
                tick={{ className: "fill-muted-foreground" }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideIndicator
                    className="min-w-40"
                    labelFormatter={(_, payload) => (payload[0]?.payload as ChartRow | undefined)?.label}
                    formatter={(value, _name, item) => (
                      <span className="flex flex-1 justify-between gap-4 leading-none">
                        <span className="text-muted-foreground">{requestCount((item.payload as ChartRow).count)}</span>
                        <span className="font-medium text-foreground tabular-nums">{formatDays(Number(value))}</span>
                      </span>
                    )}
                  />
                }
              />
              {/* A sliver for "same day", so it doesn't look like nothing was paid. */}
              <Bar
                dataKey="median"
                fill="var(--color-median)"
                radius={[2, 2, 0, 0]}
                minPointSize={(value) => (value === 0 ? 3 : 0)}
              />
            </BarChart>
          </ChartContainer>
        </div>
        <ChartNumbers>
          <table className="w-full text-sm tabular-nums">
            <caption className="sr-only">
              {title}, oldest first. Only {unit}s with paid requests are listed.
            </caption>
            <thead>
              <tr className="text-muted-foreground">
                <th scope="col" className="px-2 py-2 text-left font-normal">
                  {UNIT_COLUMNS[unit]}
                </th>
                <th scope="col" className="px-2 py-2 text-right font-normal">
                  Paid
                </th>
                <th scope="col" className="px-2 py-2 text-right font-normal">
                  Median
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filled.map((row) => (
                <tr key={row.key}>
                  <th scope="row" className="px-2 py-2 text-left font-normal whitespace-nowrap">
                    {row.label}
                  </th>
                  <td className="px-2 py-2 text-right">{row.count.toLocaleString()}</td>
                  <td className="px-2 py-2 text-right font-medium">{formatDays(row.median ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartNumbers>
      </div>
    </section>
  );
}

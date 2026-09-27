"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis, type XAxisTickContentProps } from "recharts";
import {
  BucketTick,
  ChartNumbers,
  compactUsd,
  DashedLineIcon,
  UNIT_COLUMNS,
  type ChartBefore,
} from "@/components/reports/report-chart";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { IsoDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { beforeBucketLabel } from "@/lib/reports/comparison";
import { bucketLabel, bucketTick, type Timeline } from "@/lib/reports/timeline";
import { runningTotals } from "@/lib/reports/timing";

type ChartRow = {
  key: string;
  tick: string;
  label: string;
  cents: number | null;
  before: number | null;
  beforeLabel: string | null;
  /** Something was spent in this stretch of either period, so the table lists it. */
  changed: boolean;
};

/**
 * The report's running total through its period, against the period
 * before's at the same point. A running period's line stops at today.
 */
export function RunningTotalChart({
  timeline,
  before,
  label,
  today,
  running,
}: {
  timeline: Timeline;
  /** The period before lined up with the bars, and its total. */
  before: (ChartBefore & { cents: number }) | null;
  /** The report's period, e.g. "September 2026". */
  label: string;
  today: IsoDate;
  /** The period hasn't ended yet. */
  running: boolean;
}) {
  const { unit, buckets } = timeline;
  const points = runningTotals(timeline, before?.buckets ?? null, today);
  const rows: ChartRow[] = buckets.map((bucket, index) => {
    const earlier = before?.buckets[index] ?? null;
    return {
      key: bucket.start,
      tick: bucketTick(bucket, unit),
      label: bucketLabel(bucket, unit),
      ...points[index],
      beforeLabel: earlier && beforeBucketLabel(earlier, unit),
      changed: (points[index].cents !== null && bucket.cents > 0) || (earlier?.cents ?? 0) > 0,
    };
  });
  const latest = rows.findLast((row) => row.cents !== null) ?? rows[0];
  const config = {
    cents: { label, color: "var(--primary)" },
    before: { label: before?.label ?? "Period before", color: "var(--muted-foreground)", icon: DashedLineIcon },
  } satisfies ChartConfig;

  return (
    <section aria-labelledby="report-running-heading" className="space-y-3">
      <div>
        <h2 id="report-running-heading" className="text-lg font-semibold">
          Running total
        </h2>
        <p className="text-sm text-muted-foreground">
          {formatCents(latest.cents ?? 0)} {running ? "so far" : "in all"}
          {before && `, against ${formatCents(before.cents)} in ${before.label}`}
        </p>
      </div>
      <div className="rounded-lg border">
        {/* Pointer and touch only. "Show the numbers" has the same data for everyone. */}
        <div aria-hidden className="px-2 pt-4">
          <ChartContainer config={config} className="aspect-auto h-48 w-full @4xl/main:h-64">
            <LineChart data={rows} accessibilityLayer={false} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
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
                tick={{ className: "fill-muted-foreground" }}
                tickFormatter={(cents: number) => compactUsd.format(cents / 100)}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="min-w-44"
                    labelFormatter={(_, payload) => (payload[0]?.payload as ChartRow | undefined)?.label}
                    formatter={(value, name, item) => {
                      const earlier = name === "before";
                      const row = item.payload as ChartRow;
                      return (
                        <>
                          {earlier ? (
                            <DashedLineIcon />
                          ) : (
                            <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
                          )}
                          <span className="flex flex-1 justify-between gap-4 leading-none">
                            <span className="text-muted-foreground">{earlier ? row.beforeLabel : "This period"}</span>
                            <span className="font-medium text-foreground tabular-nums">{formatCents(Number(value))}</span>
                          </span>
                        </>
                      );
                    }}
                  />
                }
              />
              <ChartLegend itemSorter={null} content={<ChartLegendContent />} />
              <Line
                dataKey="cents"
                type="linear"
                stroke="var(--color-cents)"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
              {before && (
                <Line
                  dataKey="before"
                  type="linear"
                  stroke="var(--color-before)"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                  activeDot={false}
                  connectNulls={false}
                />
              )}
            </LineChart>
          </ChartContainer>
        </div>
        <ChartNumbers>
          <table className="w-full text-sm tabular-nums">
            <caption className="sr-only">
              Running total, oldest first. Only {unit}s where a total changed are listed.
              {before && ` Before is the running total of ${before.label} at the same point.`}
            </caption>
            <thead>
              <tr className="text-muted-foreground">
                <th scope="col" className="px-2 py-2 text-left font-normal">
                  {UNIT_COLUMNS[unit]}
                </th>
                <th scope="col" className="px-2 py-2 text-right font-normal">
                  Total
                </th>
                {before && (
                  <th scope="col" className="px-2 py-2 text-right font-normal">
                    Before
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows
                .filter((row) => row.changed)
                .map((row) => (
                  <tr key={row.key}>
                    <th scope="row" className="px-2 py-2 text-left font-normal whitespace-nowrap">
                      {row.label}
                    </th>
                    <td className="px-2 py-2 text-right font-medium">
                      {row.cents === null ? "—" : formatCents(row.cents)}
                    </td>
                    {before && (
                      <td className="px-2 py-2 text-right text-muted-foreground">
                        {row.before === null ? "—" : formatCents(row.before)}
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </ChartNumbers>
      </div>
    </section>
  );
}

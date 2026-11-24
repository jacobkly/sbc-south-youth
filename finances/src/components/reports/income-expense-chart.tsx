"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, type XAxisTickContentProps } from "recharts";
import { MONEY_CHART_CONFIG, MONEY_SERIES, type MoneySeries } from "@/components/dashboard/chart-config";
import { BucketTick, ChartNumbers, compactUsd, UNIT_COLUMNS } from "@/components/reports/report-chart";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatCents } from "@/lib/money";
import type { ProfitTimeline } from "@/lib/reports/profit";
import { bucketLabel, bucketTick } from "@/lib/reports/timeline";

type ChartRow = { key: string; tick: string; label: string; profit: number } & Record<MoneySeries, number>;

/** The report's income and expenses over its period, side by side, with each bucket's profit. */
export function IncomeExpenseChart({ timeline }: { timeline: ProfitTimeline }) {
  const { unit, buckets } = timeline;
  const rows: ChartRow[] = buckets.map((bucket) => ({
    key: bucket.start,
    tick: bucketTick(bucket, unit),
    label: bucketLabel(bucket, unit),
    income: bucket.income,
    expenses: bucket.expenses,
    profit: bucket.profit,
  }));
  const filled = rows.filter((row) => row.income !== 0 || row.expenses !== 0);
  if (filled.length === 0) return null;
  const best = filled.reduce((most, row) => (row.profit > most.profit ? row : most), filled[0]);

  return (
    <section aria-labelledby="income-expense-heading" className="space-y-3">
      <div>
        <h2 id="income-expense-heading" className="text-lg font-semibold">
          Income and expenses by {unit}
        </h2>
        <p className="text-sm text-muted-foreground">
          {best.profit > 0 ? `Most profit: ${best.label}, ${formatCents(best.profit)}` : `No ${unit} made a profit`}
        </p>
      </div>
      <div className="rounded-lg border">
        {/* Pointer and touch only. "Show the numbers" has the same data for everyone. */}
        <div aria-hidden className="px-2 pt-4">
          <ChartContainer config={MONEY_CHART_CONFIG} className="aspect-auto h-48 w-full @4xl/main:h-64">
            <BarChart data={rows} accessibilityLayer={false} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
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
                    labelFormatter={(_, payload) => {
                      const row = payload[0]?.payload as ChartRow | undefined;
                      return (
                        row && (
                          <span className="flex justify-between gap-4">
                            {row.label}
                            <span className="tabular-nums">
                              <span className="font-normal text-muted-foreground">Profit </span>
                              {formatCents(row.profit)}
                            </span>
                          </span>
                        )
                      );
                    }}
                    formatter={(value, name, item) => (
                      <>
                        <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
                        <span className="flex flex-1 justify-between gap-4 leading-none">
                          <span className="text-muted-foreground">{MONEY_CHART_CONFIG[name as MoneySeries].label}</span>
                          <span className="font-medium text-foreground tabular-nums">{formatCents(Number(value))}</span>
                        </span>
                      </>
                    )}
                  />
                }
              />
              <ChartLegend itemSorter={null} content={<ChartLegendContent />} />
              {MONEY_SERIES.map((series) => (
                <Bar key={series} dataKey={series} fill={`var(--color-${series})`} />
              ))}
            </BarChart>
          </ChartContainer>
        </div>

        <ChartNumbers>
          <table className="w-full text-sm tabular-nums">
            <caption className="sr-only">
              Income and expenses by {unit}, oldest first. Only {unit}s with either are listed.
            </caption>
            <thead>
              <tr className="text-muted-foreground">
                <th scope="col" className="px-2 py-2 text-left font-normal">
                  {UNIT_COLUMNS[unit]}
                </th>
                {MONEY_SERIES.map((series) => (
                  <th key={series} scope="col" className="px-2 py-2 text-right font-normal">
                    {MONEY_CHART_CONFIG[series].label}
                  </th>
                ))}
                <th scope="col" className="px-2 py-2 text-right font-normal">
                  Profit
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filled.map((row) => (
                <tr key={row.key}>
                  <th scope="row" className="px-2 py-2 text-left font-normal whitespace-nowrap">
                    {row.label}
                  </th>
                  {MONEY_SERIES.map((series) => (
                    <td key={series} className="px-2 py-2 text-right">
                      {formatCents(row[series])}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right font-medium">{formatCents(row.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartNumbers>
      </div>
    </section>
  );
}

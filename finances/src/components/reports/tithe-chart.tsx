"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, type XAxisTickContentProps } from "recharts";
import { TYPE_CHART_CONFIG } from "@/components/dashboard/chart-config";
import { plural } from "@/components/income/stat";
import { BucketTick, ChartNumbers, compactUsd, NoValue } from "@/components/reports/report-chart";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { monthShortName, periodLabel } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import type { TitheMonth } from "@/lib/reports/income";

/** Tithes are youth money, so they take youth's color. */
const CHART_CONFIG = {
  tithes: { label: "Tithes", color: TYPE_CHART_CONFIG.youth.color },
} satisfies ChartConfig;

type ChartRow = { key: string; tick: string; label: string; tithes: number; count: number; average: number | null };

/** Each month's tithes across the report's period, oldest first. */
export function TitheChart({ months }: { months: TitheMonth[] }) {
  const rows: ChartRow[] = months.map(({ period, count, total, average }) => ({
    key: `${period.year}-${period.month}`,
    tick: monthShortName(period),
    label: periodLabel(period),
    tithes: total,
    count,
    average,
  }));
  const busiest = rows.reduce((most, row) => (row.tithes > most.tithes ? row : most), rows[0]);

  return (
    <section aria-labelledby="income-months-heading" className="space-y-3">
      <div>
        <h2 id="income-months-heading" className="text-lg font-semibold">
          Tithes by month
        </h2>
        <p className="text-sm text-muted-foreground">
          Busiest month: {busiest.label}, {formatCents(busiest.tithes)}
        </p>
      </div>
      <div className="rounded-lg border">
        {/* Pointer and touch only. "Show the numbers" has the same data for everyone. */}
        <div aria-hidden className="px-2 pt-4">
          <ChartContainer config={CHART_CONFIG} className="aspect-auto h-48 w-full @4xl/main:h-64">
            <BarChart data={rows} accessibilityLayer={false} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="tick"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={0}
                tick={(props: XAxisTickContentProps) => <BucketTick {...props} unit="month" />}
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
                    formatter={(value, _, item) => (
                      <>
                        <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
                        <span className="flex flex-1 justify-between gap-4 leading-none">
                          <span className="text-muted-foreground">
                            {plural((item.payload as ChartRow).count, "tithe", "tithes")}
                          </span>
                          <span className="font-medium text-foreground tabular-nums">{formatCents(Number(value))}</span>
                        </span>
                      </>
                    )}
                  />
                }
              />
              {/* A quarter is only three bars, so they'd be very wide. */}
              <Bar dataKey="tithes" fill="var(--color-tithes)" maxBarSize={56} />
            </BarChart>
          </ChartContainer>
        </div>

        <ChartNumbers>
          <table className="w-full text-sm tabular-nums">
            <caption className="sr-only">Tithes by month, oldest first</caption>
            <thead>
              <tr className="text-muted-foreground">
                <th scope="col" className="px-2 py-2 text-left font-normal">
                  Month
                </th>
                <th scope="col" className="px-2 py-2 text-right font-normal">
                  Tithes
                </th>
                <th scope="col" className="px-2 py-2 text-right font-normal">
                  Total
                </th>
                <th scope="col" className="px-2 py-2 text-right font-normal">
                  Average
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row" className="px-2 py-2 text-left font-normal whitespace-nowrap">
                    {row.label}
                  </th>
                  <td className="px-2 py-2 text-right">{row.count.toLocaleString()}</td>
                  <td className="px-2 py-2 text-right font-medium">{formatCents(row.tithes)}</td>
                  <td className="px-2 py-2 text-right text-muted-foreground">
                    {row.average === null ? <NoValue /> : formatCents(row.average)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartNumbers>
      </div>
    </section>
  );
}

"use client";

import { ChevronDownIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Text, XAxis, YAxis, type XAxisTickContentProps } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { MoneyPeriod } from "@/lib/dashboard/money";
import { monthShortName, periodLabel, type MonthPeriod } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { IN_OUT_CHART_CONFIG, IN_OUT_SERIES, type InOutSeries } from "./chart-config";

const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

type ChartRow = { key: string; month: string; shortLabel: string; label: string; left: number } & Record<
  InOutSeries,
  number
>;

/** Every month gets a label: initials when bars are narrow, like the iPhone Health app. */
function MonthTick({ x, y, payload, width, visibleTicksCount }: XAxisTickContentProps) {
  const name = String(payload.value);
  const narrow = Number(width) / visibleTicksCount < 30;
  return (
    <Text x={x} y={y} textAnchor="middle" verticalAnchor="start" className="fill-muted-foreground">
      {narrow ? name.charAt(0) : name}
    </Text>
  );
}

/** Money in and paid out for the last 12 months, side by side. */
export function MonthlyChart({ months }: { months: MoneyPeriod<MonthPeriod>[] }) {
  const rows: ChartRow[] = months.map(({ period, moneyIn, paidOut, left }) => ({
    key: `${period.year}-${period.month}`,
    month: monthShortName(period),
    shortLabel: `${monthShortName(period)} ${period.year}`,
    label: periodLabel(period),
    in: moneyIn.total,
    out: paidOut,
    left,
  }));
  const range = `${rows[0].label} – ${rows[rows.length - 1].label}`;
  const hasAny = rows.some((row) => row.in > 0 || row.out > 0);

  return (
    <Card className="gap-0 pb-0">
      <CardHeader>
        <CardTitle>
          <h2>In and out by month</h2>
        </CardTitle>
        <CardDescription>{range}</CardDescription>
      </CardHeader>

      {hasAny ? (
        <>
          {/* Pointer and touch only. "Show the numbers" has the same data for everyone. */}
          <div aria-hidden className="px-2 pt-4">
            <ChartContainer config={IN_OUT_CHART_CONFIG} className="aspect-auto h-60 w-full">
              <BarChart data={rows} accessibilityLayer={false} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} interval={0} tick={MonthTick} />
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
                                <span className="font-normal text-muted-foreground">Left </span>
                                {formatCents(row.left)}
                              </span>
                            </span>
                          )
                        );
                      }}
                      formatter={(value, name, item) => (
                        <>
                          <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
                          <span className="flex flex-1 justify-between gap-4 leading-none">
                            <span className="text-muted-foreground">
                              {IN_OUT_CHART_CONFIG[name as InOutSeries].label}
                            </span>
                            <span className="font-medium text-foreground tabular-nums">
                              {formatCents(Number(value))}
                            </span>
                          </span>
                        </>
                      )}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                {IN_OUT_SERIES.map((series) => (
                  <Bar key={series} dataKey={series} fill={`var(--color-${series})`} />
                ))}
              </BarChart>
            </ChartContainer>
          </div>

          <details className="group border-t">
            <summary className="cursor-pointer list-none outline-none hover:bg-muted focus-visible:bg-muted [&::-webkit-details-marker]:hidden">
              <span className="flex h-11 items-center justify-between gap-2 px-4 text-sm font-medium">
                Show the numbers
                <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" aria-hidden />
              </span>
            </summary>
            <div className="overflow-x-auto px-2 pb-2">
              <table className="w-full text-sm tabular-nums">
                <caption className="sr-only">In and out by month, {range}, newest first</caption>
                <thead>
                  <tr className="text-muted-foreground">
                    <th scope="col" className="px-2 py-2 text-left font-normal">
                      Month
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-normal">
                      In
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-normal whitespace-nowrap">
                      Paid out
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-normal">
                      Left
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...rows].reverse().map((row) => (
                    <tr key={row.key}>
                      <th scope="row" className="px-2 py-2 text-left font-normal whitespace-nowrap">
                        {row.shortLabel}
                      </th>
                      <td className="px-2 py-2 text-right">{formatCents(row.in)}</td>
                      <td className="px-2 py-2 text-right">{formatCents(row.out)}</td>
                      <td className="px-2 py-2 text-right font-medium">{formatCents(row.left)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nothing in or out in the last 12 months.
        </CardContent>
      )}
    </Card>
  );
}

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
import type { PaidPeriod } from "@/lib/dashboard/summary";
import { monthShortName, periodLabel, type MonthPeriod } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { REQUEST_TYPE_LABELS } from "@/lib/requests/format";
import { REQUEST_TYPES, type RequestType } from "@/lib/requests/schema";
import { TYPE_CHART_CONFIG } from "./chart-config";

const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

type ChartRow = { key: string; month: string; shortLabel: string; label: string; total: number } & Record<
  RequestType,
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

/** Paid totals for the last 12 months, stacked by cafe and youth. */
export function MonthlyChart({ months }: { months: PaidPeriod<MonthPeriod>[] }) {
  const rows: ChartRow[] = months.map(({ period, cents, byType }) => ({
    key: `${period.year}-${period.month}`,
    month: monthShortName(period),
    shortLabel: `${monthShortName(period)} ${period.year}`,
    label: periodLabel(period),
    total: cents,
    ...byType,
  }));
  const range = `${rows[0].label} – ${rows[rows.length - 1].label}`;
  const hasPaid = rows.some((row) => row.total > 0);

  return (
    <Card className="gap-0 pb-0">
      <CardHeader>
        <CardTitle>
          <h2>Paid by month</h2>
        </CardTitle>
        <CardDescription>{range}</CardDescription>
      </CardHeader>

      {hasPaid ? (
        <>
          {/* Pointer and touch only. "Show the numbers" has the same data for everyone. */}
          <div aria-hidden className="px-2 pt-4">
            <ChartContainer config={TYPE_CHART_CONFIG} className="aspect-auto h-60 w-full">
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
                              <span className="tabular-nums">{formatCents(row.total)}</span>
                            </span>
                          )
                        );
                      }}
                      formatter={(value, name, item) => (
                        <>
                          <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
                          <span className="flex flex-1 justify-between gap-4 leading-none">
                            <span className="text-muted-foreground">{REQUEST_TYPE_LABELS[name as RequestType]}</span>
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
                {REQUEST_TYPES.map((type) => (
                  <Bar key={type} dataKey={type} stackId="paid" fill={`var(--color-${type})`} />
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
                <caption className="sr-only">Paid by month, {range}, newest first</caption>
                <thead>
                  <tr className="text-muted-foreground">
                    <th scope="col" className="px-2 py-2 text-left font-normal">
                      Month
                    </th>
                    {REQUEST_TYPES.map((type) => (
                      <th key={type} scope="col" className="px-2 py-2 text-right font-normal">
                        {REQUEST_TYPE_LABELS[type]}
                      </th>
                    ))}
                    <th scope="col" className="px-2 py-2 text-right font-normal">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...rows].reverse().map((row) => (
                    <tr key={row.key}>
                      <th scope="row" className="px-2 py-2 text-left font-normal whitespace-nowrap">
                        {row.shortLabel}
                      </th>
                      {REQUEST_TYPES.map((type) => (
                        <td key={type} className="px-2 py-2 text-right">
                          {formatCents(row[type])}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-right font-medium">{formatCents(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nothing paid in the last 12 months.
        </CardContent>
      )}
    </Card>
  );
}

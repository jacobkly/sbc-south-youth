"use client";

import { ChevronDownIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Text, XAxis, YAxis, type XAxisTickContentProps } from "recharts";
import { TYPE_CHART_CONFIG } from "@/components/dashboard/chart-config";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatCents } from "@/lib/money";
import { REQUEST_TYPE_LABELS } from "@/lib/requests/format";
import { REQUEST_TYPES, type RequestType } from "@/lib/requests/schema";
import { bucketLabel, bucketTick, type Timeline, type TimelineUnit } from "@/lib/reports/timeline";

const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const UNIT_TITLES: Record<TimelineUnit, string> = {
  day: "By day",
  week: "By week",
  month: "By month",
  year: "By year",
};

const UNIT_COLUMNS: Record<TimelineUnit, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  year: "Year",
};

/** Roughly how wide each unit's axis label is, in pixels, with room around it. */
const TICK_WIDTHS: Record<TimelineUnit, number> = { day: 22, week: 44, month: 30, year: 36 };

/** Every how many bars a label can go, fewest first, so skipped labels still land evenly. */
const TICK_STEPS: Record<TimelineUnit, number[]> = {
  day: [1, 2, 7],
  week: [1, 2, 3, 4],
  month: [1, 3, 6],
  year: [1, 2, 5, 10],
};

/** A month's initial is about this wide, like the dashboard chart. */
const INITIAL_WIDTH = 12;

type ChartRow = { key: string; tick: string; label: string; total: number } & Record<RequestType, number>;

/**
 * Labels as many bars as fit. Months fall back to initials first, like the
 * iPhone Health app, and every unit then skips bars in even steps.
 */
function BucketTick({ x, y, payload, index, width, visibleTicksCount, unit }: XAxisTickContentProps & { unit: TimelineUnit }) {
  const room = Number(width) / visibleTicksCount;
  const name = String(payload.value);
  const initials = unit === "month" && room < TICK_WIDTHS.month;
  const needed = initials ? INITIAL_WIDTH : TICK_WIDTHS[unit];
  const steps = TICK_STEPS[unit];
  const step = steps.find((each) => each * room >= needed) ?? steps[steps.length - 1];
  if (index % step !== 0) return null;
  return (
    <Text x={x} y={y} textAnchor="middle" verticalAnchor="start" className="fill-muted-foreground">
      {initials ? name.charAt(0) : name}
    </Text>
  );
}

/**
 * The report's requests over its period, stacked by cafe and youth. Bars
 * are days, weeks, months, or years, depending on how long the period is.
 */
export function ReportChart({ timeline }: { timeline: Timeline }) {
  const { unit, buckets } = timeline;
  const rows: ChartRow[] = buckets.map((bucket) => ({
    key: bucket.start,
    tick: bucketTick(bucket, unit),
    label: bucketLabel(bucket, unit),
    total: bucket.cents,
    ...bucket.byType,
  }));
  const busiest = rows.reduce((most, row) => (row.total > most.total ? row : most), rows[0]);
  const filled = rows.filter((row) => row.total > 0);
  const title = UNIT_TITLES[unit];

  return (
    <section aria-labelledby="report-chart-heading" className="space-y-3">
      <div>
        <h2 id="report-chart-heading" className="text-lg font-semibold">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">
          Busiest {unit}: {busiest.label}, {formatCents(busiest.total)}
        </p>
      </div>
      <div className="rounded-lg border">
        {/* Pointer and touch only. "Show the numbers" has the same data for everyone. */}
        <div aria-hidden className="px-2 pt-4">
          <ChartContainer config={TYPE_CHART_CONFIG} className="aspect-auto h-48 w-full">
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
                          <span className="font-medium text-foreground tabular-nums">{formatCents(Number(value))}</span>
                        </span>
                      </>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {REQUEST_TYPES.map((type) => (
                <Bar key={type} dataKey={type} stackId="report" fill={`var(--color-${type})`} />
              ))}
            </BarChart>
          </ChartContainer>
        </div>

        <details className="group border-t">
          <summary className="cursor-pointer list-none rounded-b-lg outline-none hover:bg-muted focus-visible:bg-muted group-open:rounded-none [&::-webkit-details-marker]:hidden">
            <span className="flex h-11 items-center justify-between gap-2 px-4 text-sm font-medium">
              Show the numbers
              <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" aria-hidden />
            </span>
          </summary>
          <div className="overflow-x-auto px-2 pb-2">
            <table className="w-full text-sm tabular-nums">
              <caption className="sr-only">
                {title}, oldest first. Only {unit}s with requests are listed.
              </caption>
              <thead>
                <tr className="text-muted-foreground">
                  <th scope="col" className="px-2 py-2 text-left font-normal">
                    {UNIT_COLUMNS[unit]}
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
                {filled.map((row) => (
                  <tr key={row.key}>
                    <th scope="row" className="px-2 py-2 text-left font-normal whitespace-nowrap">
                      {row.label}
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
      </div>
    </section>
  );
}

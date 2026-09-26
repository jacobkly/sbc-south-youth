"use client";

import { useState } from "react";
import { Pie, PieChart } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { sharePercent, type PaidTotals } from "@/lib/dashboard/summary";
import { periodLabel } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { REQUEST_TYPE_LABELS } from "@/lib/requests/format";
import { REQUEST_TYPES } from "@/lib/requests/schema";
import { TYPE_CHART_CONFIG } from "./chart-config";

const KINDS = ["month", "quarter", "year"] as const;
type Kind = (typeof KINDS)[number];

const KIND_LABELS: Record<Kind, string> = { month: "Month", quarter: "Quarter", year: "Year" };

const SELECTED = "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground hover:data-[state=on]:bg-primary/90";

/** Cafe vs. youth paid this month, quarter, or year. Uses the same totals as the cards. */
export function TypeSplitChart({ paid }: { paid: PaidTotals }) {
  const [kind, setKind] = useState<Kind>("year");
  const { period, cents: total, byType } = paid[kind];
  const label = periodLabel(period);
  const slices = REQUEST_TYPES.map((type) => ({ type, cents: byType[type], fill: `var(--color-${type})` }));

  return (
    <Card className="@container">
      <CardHeader>
        <CardTitle>
          <h2>Cafe vs. youth</h2>
        </CardTitle>
        <CardDescription aria-live="polite">Paid in {label}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          value={kind}
          onValueChange={(value) => value && setKind(value as Kind)}
          aria-label="Period"
          className="w-full @sm:w-auto"
        >
          {KINDS.map((option) => (
            <ToggleGroupItem key={option} value={option} className={`h-11 flex-1 px-4 @sm:flex-none ${SELECTED}`}>
              {KIND_LABELS[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {total > 0 ? (
          <div className="mx-auto flex max-w-md items-center gap-4 @md:gap-8">
            {/* The list beside it has the same numbers for everyone. */}
            <div aria-hidden className="size-28 shrink-0">
              <ChartContainer
                config={TYPE_CHART_CONFIG}
                initialDimension={{ width: 112, height: 112 }}
                className="aspect-square size-28"
              >
                <PieChart accessibilityLayer={false}>
                  <Pie
                    data={slices}
                    dataKey="cents"
                    nameKey="type"
                    innerRadius="58%"
                    outerRadius="100%"
                    stroke="var(--background)"
                    strokeWidth={2}
                  />
                </PieChart>
              </ChartContainer>
            </div>
            <dl className="min-w-0 flex-1 divide-y text-sm">
              {slices.map(({ type, cents }) => (
                <div key={type} className="flex items-center justify-between gap-3 py-2 first:pt-0">
                  <dt className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: TYPE_CHART_CONFIG[type].color }}
                    />
                    {REQUEST_TYPE_LABELS[type]}
                  </dt>
                  <dd className="text-right tabular-nums">
                    <span className="block font-medium">{formatCents(cents)}</span>
                    <span className="block text-muted-foreground">{sharePercent(cents, total)}</span>
                  </dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 pt-2">
                <dt className="font-medium">Total</dt>
                <dd className="font-semibold tabular-nums">{formatCents(total)}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing paid in {label}.</p>
        )}
      </CardContent>
    </Card>
  );
}

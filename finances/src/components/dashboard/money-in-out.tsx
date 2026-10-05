"use client";

import { useState } from "react";
import { cn } from "cn";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { MoneyTotals } from "@/lib/dashboard/money";
import { periodLabel } from "@/lib/dates";
import { formatCents } from "@/lib/money";

const KINDS = ["month", "quarter", "year"] as const;
type Kind = (typeof KINDS)[number];

const KIND_LABELS: Record<Kind, string> = { month: "Month", quarter: "Quarter", year: "Year" };

const SELECTED = "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground hover:data-[state=on]:bg-primary/90";

/** One line of the list. A sub line is part of the line above it. */
function Row({
  label,
  cents,
  note,
  sub = false,
  className,
}: {
  label: string;
  cents: number;
  note?: string;
  sub?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3",
        sub ? "py-1 pl-4 text-muted-foreground" : "py-2",
        className,
      )}
    >
      <dt className={cn(!sub && "font-medium")}>{label}</dt>
      <dd className={cn("tabular-nums", !sub && "font-semibold")}>{formatCents(cents)}</dd>
      {note && <dd className="col-span-2 text-xs text-muted-foreground">{note}</dd>}
    </div>
  );
}

/** Money in, paid out, and what's left this month, quarter, or year, plus cafe profit. */
export function MoneyInOut({ money }: { money: MoneyTotals }) {
  const [kind, setKind] = useState<Kind>("month");
  const { period, moneyIn, paidOut, left, cafeProfit } = money[kind];

  return (
    <Card className="@container">
      <CardHeader>
        <CardTitle>
          <h2>Money in and out</h2>
        </CardTitle>
        <CardDescription aria-live="polite">{periodLabel(period)}</CardDescription>
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

        <dl className="text-sm">
          <Row label="Money in" cents={moneyIn.total} note={moneyIn.total === 0 ? "Nothing in yet" : undefined} />
          {moneyIn.total > 0 && (
            <>
              <Row sub label="Tithes and events" cents={moneyIn.youth} />
              <Row sub label="Cafe sales" cents={moneyIn.cafe} />
            </>
          )}
          <Row label="Paid out" cents={paidOut} />
          <Row
            label="Left"
            cents={left}
            note={left < 0 ? "More was paid out than came in" : undefined}
            className="border-t"
          />
          <Row
            label="Cafe profit"
            cents={cafeProfit}
            note={cafeProfit < 0 ? "Cafe costs are ahead of sales" : "Cafe sales minus cafe costs"}
            className="border-t"
          />
        </dl>

        <p className="text-xs text-muted-foreground">
          Paid out uses the date paid, like the totals above. Cafe profit matches the Income page, with costs by
          purchase date.
        </p>
      </CardContent>
    </Card>
  );
}

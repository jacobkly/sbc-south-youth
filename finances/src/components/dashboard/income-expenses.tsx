"use client";

import { useState } from "react";
import { cn } from "cn";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { MoneyTotals } from "@/lib/dashboard/money";
import { periodLabel } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { REQUEST_TYPE_LABELS } from "@/lib/requests/format";
import { REQUEST_TYPES } from "@/lib/requests/schema";

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

/** What makes up income, expenses, and profit this month, quarter, or year, plus cafe profit. */
export function IncomeExpenses({ money }: { money: MoneyTotals }) {
  const [kind, setKind] = useState<Kind>("month");
  const { period, income, expenses, expensesByType, profit, paidBack, cafeProfit } = money[kind];

  return (
    <Card className="@container">
      <CardHeader>
        <CardTitle>
          <h2>Income and expenses</h2>
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
          <Row label="Income" cents={income.total} note={income.total === 0 ? "Nothing in yet" : undefined} />
          {income.total > 0 && (
            <>
              <Row sub label="Tithes and events" cents={income.youth} />
              <Row sub label="Cafe, from Square" cents={income.square} />
              {income.discounts > 0 && <Row sub label="Cafe discounts" cents={income.discounts} />}
              {income.giftCards > 0 && <Row sub label="Cafe gift cards" cents={income.giftCards} />}
            </>
          )}
          <Row
            label="Expenses"
            cents={expenses}
            note={expenses === 0 ? "Nothing paid yet" : undefined}
            className="border-t"
          />
          {expenses > 0 &&
            REQUEST_TYPES.map((type) => (
              <Row key={type} sub label={REQUEST_TYPE_LABELS[type]} cents={expensesByType[type]} />
            ))}
          <Row
            label="Profit"
            cents={profit}
            note={profit < 0 ? "More was spent than came in" : undefined}
            className="border-t"
          />
          <Row
            label="Cafe profit"
            cents={cafeProfit}
            note={cafeProfit < 0 ? "Cafe costs are ahead of sales" : "Cafe income minus cafe costs"}
            className="border-t"
          />
        </dl>

        <p className="text-xs text-muted-foreground">
          Expenses use the date paid. Cafe profit matches the Income page, which uses the purchase date for costs.
          {paidBack > 0 &&
            ` The church paid back ${formatCents(paidBack)} of discounts, which income already counts.`}
        </p>
      </CardContent>
    </Card>
  );
}

import type { ReactNode } from "react";
import { ChevronRightIcon, PlusIcon } from "lucide-react";
import { plural, Stat } from "@/components/income/stat";
import { MonthFold, YearFold } from "@/components/income/fold";
import { Button } from "@/components/ui/button";
import { monthName, periodLabel, type IsoDate, type MonthPeriod } from "@/lib/dates";
import {
  cafeTotalsIn,
  groupWeeksByMonth,
  moneyFromSquare,
  paybackStatus,
  quarterStartOf,
  type CafeCost,
  type CafePaybackIncome,
  type CafeTotals,
  type CafeWeek,
  type DiscountQuarter,
  type PaybackStatus,
} from "@/lib/income/cafe";
import { groupMonthsByYear } from "@/lib/income/stats";
import { relativeWeekLabel, weekLabel } from "@/lib/income/weeks";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * This month's money from Square, discounts, costs, and profit, plus the
 * church's gift card money in a month it came in.
 */
export function CafeMonthSummary({ month, totals }: { month: MonthPeriod; totals: CafeTotals }) {
  const giftCards = totals.giftCards > 0;
  // Five don't pair up on a phone, so profit takes the last row.
  const profitClass = giftCards ? "col-span-2 desktop:col-span-1" : undefined;
  return (
    <section aria-labelledby="cafe-month-heading" className="space-y-2">
      <h2 id="cafe-month-heading" className="text-sm font-medium text-muted-foreground">
        This month · {periodLabel(month)}
      </h2>
      <div className={cn("grid grid-cols-2 gap-2", giftCards ? "desktop:grid-cols-5" : "desktop:grid-cols-4")}>
        <Stat label="From Square" value={formatCents(totals.moneyIn)} note={plural(totals.weeks, "week", "weeks")} />
        <Stat label="Discounts" value={formatCents(totals.discounts)} note="The church pays back" />
        {giftCards && <Stat label="Gift cards" value={formatCents(totals.giftCards)} note="The church prepaid" />}
        <Stat label="Cafe costs" value={formatCents(totals.costs)} note="Cafe requests" />
        <Stat
          label="Profit"
          value={formatCents(totals.profit)}
          note={
            totals.profit < 0
              ? "Costs are ahead"
              : giftCards
                ? "Square, discounts, and gift cards, less costs"
                : "Square and discounts, less costs"
          }
          className={profitClass}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        From Square is card, cash, and Cash App, less Square&apos;s fees. Costs are approved and paid cafe requests,
        by purchase date. A week counts in the month it ends
        {giftCards ? ", and the church's gift card money in the month it came in." : "."}
      </p>
    </section>
  );
}

const PAYBACK_LABELS: Record<PaybackStatus, string> = {
  paid: "Paid back",
  partly: "Partly paid back",
  owed: "Not paid back",
};

/**
 * Cafe weeks by year and month, newest first, with each one's money, costs,
 * and profit, and whether each week's discounts are paid back. The newest year
 * and its newest month start open. Owners tap a week to edit it. Viewers see
 * the same list with nothing to tap.
 */
export function CafeWeekList({
  weeks,
  costs,
  paybacks,
  quarters,
  today,
  onOpen,
  onAdd,
  importButton,
}: {
  weeks: CafeWeek[];
  costs: CafeCost[];
  /** The church's paybacks. Its gift card money counts in each month's profit. */
  paybacks: CafePaybackIncome[];
  /** Each quarter's discounts and paybacks, from `discountQuarters`. */
  quarters: DiscountQuarter[];
  today: IsoDate;
  /** Opens a week to edit. Left out for viewers. */
  onOpen?: (week: CafeWeek) => void;
  /** Starts a new week. Left out for viewers. */
  onAdd?: () => void;
  /** Imports weeks from Square, offered when there are none yet. Left out for viewers. */
  importButton?: ReactNode;
}) {
  if (weeks.length === 0) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        <p>No cafe weeks yet.</p>
        {(importButton || onAdd) && (
          <div className="flex flex-col items-center justify-center gap-2 desktop:flex-row">
            {importButton}
            {onAdd && (
              <Button className="h-11 px-5" onClick={onAdd}>
                <PlusIcon />
                Add the first week
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  const statusOf = new Map(quarters.map((quarter) => [quarter.start, paybackStatus(quarter)]));
  /** How many weeks, and the money behind the profit. */
  function foldLines(totals: CafeTotals) {
    return {
      note: plural(totals.weeks, "week", "weeks"),
      total: <Profit cents={totals.profit} />,
      detail: moneyLine(totals),
    };
  }

  return (
    <section aria-labelledby="cafe-weeks-heading">
      <h2 id="cafe-weeks-heading" className="pb-1 text-sm font-medium text-muted-foreground">
        Weeks
      </h2>
      <div className="divide-y">
        {groupMonthsByYear(groupWeeksByMonth(weeks, costs, paybacks)).map(({ year, months }, yearIndex) => (
          <YearFold
            key={year}
            title={String(year)}
            defaultOpen={yearIndex === 0}
            {...foldLines(cafeTotalsIn(weeks, costs, paybacks, { kind: "year", year }))}
          >
            {months.map(({ period, totals, weeks: monthWeeks }, monthIndex) => (
              <MonthFold
                key={period.month}
                title={monthName(period)}
                defaultOpen={yearIndex === 0 && monthIndex === 0}
                {...foldLines(totals)}
              >
                <ul className="divide-y">
                  {monthWeeks.map((week) => (
                    <li key={week.id}>
                      <WeekRow
                        week={week}
                        status={statusOf.get(quarterStartOf(week.week_ending)) ?? "owed"}
                        today={today}
                        onOpen={onOpen}
                      />
                    </li>
                  ))}
                </ul>
              </MonthFold>
            ))}
          </YearFold>
        ))}
      </div>
    </section>
  );
}

function Profit({ cents }: { cents: number }) {
  return (
    <span>
      <span className="text-muted-foreground">Profit </span>
      {formatCents(cents)}
    </span>
  );
}

/** "From Square $650.00 · Discounts $45.00 · Costs $120.00" */
function moneyLine(totals: CafeTotals): string {
  return [
    `From Square ${formatCents(totals.moneyIn)}`,
    totals.discounts > 0 && `Discounts ${formatCents(totals.discounts)}`,
    totals.giftCards > 0 && `Gift cards ${formatCents(totals.giftCards)}`,
    `Costs ${formatCents(totals.costs)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function WeekRow({
  week,
  status,
  today,
  onOpen,
}: {
  week: CafeWeek;
  /** Where its quarter's discounts stand. Shown only when it has discounts. */
  status: PaybackStatus;
  today: IsoDate;
  onOpen?: (week: CafeWeek) => void;
}) {
  const detail = [relativeWeekLabel(week.week_ending, today), week.note].filter(Boolean).join(" · ");
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{weekLabel(week.week_ending, today)}</p>
        {detail && <p className="truncate text-sm text-muted-foreground">{detail}</p>}
        {week.discounts_cents > 0 && (
          <p className="text-sm text-muted-foreground tabular-nums">
            Discounts {formatCents(week.discounts_cents)} ·{" "}
            <span className="whitespace-nowrap">{PAYBACK_LABELS[status]}</span>
          </p>
        )}
      </div>
      <span className="shrink-0 text-right tabular-nums">{formatCents(moneyFromSquare(week))}</span>
    </>
  );
  const row = "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left";

  if (!onOpen) return <div className={row}>{content}</div>;
  return (
    <button
      type="button"
      className={cn(row, "outline-none hover:bg-muted focus-visible:bg-muted")}
      onClick={() => onOpen(week)}
    >
      {content}
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

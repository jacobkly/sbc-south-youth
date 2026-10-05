import { ChevronRightIcon, PlusIcon } from "lucide-react";
import { plural, Stat } from "@/components/income/stat";
import { Button } from "@/components/ui/button";
import { periodLabel, type IsoDate, type MonthPeriod } from "@/lib/dates";
import { groupWeeksByMonth, type CafeCost, type CafeTotals, type CafeWeek } from "@/lib/income/cafe";
import { relativeWeekLabel, weekLabel } from "@/lib/income/weeks";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

/** This month's cafe sales, costs, profit, and average week. */
export function CafeMonthSummary({ month, totals }: { month: MonthPeriod; totals: CafeTotals }) {
  return (
    <section aria-labelledby="cafe-month-heading" className="space-y-2">
      <h2 id="cafe-month-heading" className="text-sm font-medium text-muted-foreground">
        This month · {periodLabel(month)}
      </h2>
      <div className="grid grid-cols-2 gap-2 desktop:grid-cols-4">
        <Stat label="Sales" value={formatCents(totals.sales)} note={plural(totals.weeks, "week", "weeks")} />
        <Stat label="Cafe costs" value={formatCents(totals.costs)} note="Cafe requests" />
        <Stat
          label="Profit"
          value={formatCents(totals.profit)}
          note={totals.profit < 0 ? "Costs are ahead of sales" : "Sales minus costs"}
        />
        <Stat
          label="Average week"
          value={totals.average === null ? "—" : formatCents(totals.average)}
          note={totals.average === null ? "No weeks yet" : "Sales per week"}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Costs are approved and paid cafe requests, by purchase date. A week counts in the month it ends.
      </p>
    </section>
  );
}

/**
 * Cafe weeks by month, newest first, with each month's sales, costs, and
 * profit. Owners tap a week to edit it. Viewers see the same list with
 * nothing to tap.
 */
export function CafeWeekList({
  weeks,
  costs,
  today,
  onOpen,
  onAdd,
}: {
  weeks: CafeWeek[];
  costs: CafeCost[];
  today: IsoDate;
  /** Opens a week to edit. Left out for viewers. */
  onOpen?: (week: CafeWeek) => void;
  /** Starts a new week. Left out for viewers. */
  onAdd?: () => void;
}) {
  if (weeks.length === 0) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        <p>No cafe weeks yet.</p>
        {onAdd && (
          <Button className="h-11 px-5" onClick={onAdd}>
            <PlusIcon />
            Add the first week
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupWeeksByMonth(weeks, costs).map(({ period, totals, weeks: monthWeeks }) => {
        const headingId = `cafe-${period.year}-${period.month}`;
        return (
          <section key={headingId} aria-labelledby={headingId} className="space-y-2">
            <div className="space-y-0.5 px-1">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id={headingId} className="text-sm font-medium">
                  {periodLabel(period)}
                </h2>
                <p className="text-sm tabular-nums">
                  <span className="text-muted-foreground">Profit </span>
                  {formatCents(totals.profit)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                Sales {formatCents(totals.sales)} · Costs {formatCents(totals.costs)}
              </p>
            </div>
            <ul className="divide-y overflow-hidden rounded-lg border">
              {monthWeeks.map((week) => (
                <li key={week.id}>
                  <WeekRow week={week} today={today} onOpen={onOpen} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function WeekRow({ week, today, onOpen }: { week: CafeWeek; today: IsoDate; onOpen?: (week: CafeWeek) => void }) {
  const detail = [relativeWeekLabel(week.week_ending, today), week.note].filter(Boolean).join(" · ");
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{weekLabel(week.week_ending, today)}</p>
        {detail && <p className="truncate text-sm text-muted-foreground">{detail}</p>}
      </div>
      <span className="shrink-0 text-right tabular-nums">{formatCents(week.sales_cents)}</span>
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

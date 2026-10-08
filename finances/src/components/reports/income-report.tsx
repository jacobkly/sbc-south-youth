import type { ReactNode } from "react";
import { TYPE_CHART_CONFIG } from "@/components/dashboard/chart-config";
import { plural } from "@/components/income/stat";
import { Breakdown, requestCount } from "@/components/reports/breakdown";
import { ChangeLine } from "@/components/reports/change-line";
import { TitheChart } from "@/components/reports/tithe-chart";
import { periodLabel, type Period } from "@/lib/dates";
import { INCOME_METHOD_LABELS } from "@/lib/income/schema";
import { youthSummary } from "@/lib/income/stats";
import { formatCents } from "@/lib/money";
import { REQUEST_TYPE_LABELS } from "@/lib/requests/format";
import { REQUEST_TYPES } from "@/lib/requests/schema";
import { comparisonLabel } from "@/lib/reports/comparison";
import type { ReportFilters } from "@/lib/reports/filters";
import { incomeTotals, titheMonths, type OutRow, type ReportIncome } from "@/lib/reports/income";

/** The period before, to compare the Income tab with. */
export type IncomeBefore = { period: Period; income: ReportIncome; rows: readonly OutRow[] };

/** The period as a sentence ends it: "in Q3 2026", or a custom range on its own. */
function within(period: Period): string {
  const label = periodLabel(period);
  return period.kind === "custom" ? label : `in ${label}`;
}

/**
 * One amount in a bordered list, like the Overview's totals: label and
 * amount side by side on a phone, and a column each when there's room.
 */
function Cell({
  label,
  swatch,
  cents,
  detail,
  change,
}: {
  label: string;
  /** A type's color, so the cell matches its charts. */
  swatch?: string;
  cents: number;
  detail: string;
  change?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3 @md:flex-col @md:justify-start @md:gap-1">
      <dt className="flex items-center gap-2 text-sm">
        {swatch && <span aria-hidden className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: swatch }} />}
        {label}
      </dt>
      <dd className="text-right tabular-nums @md:text-left">
        <span className="block font-semibold">{formatCents(cents)}</span>
        <span className="block text-sm text-muted-foreground">{detail}</span>
        {change}
      </dd>
    </div>
  );
}

function Heading({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <div>
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </div>
  );
}

/**
 * The Income tab: money in against the report's requests, what's left, each
 * type's profit, and the tithes. Money in counts by the day it came in, or
 * the Sunday a cafe week ends, whatever the requests are counted by.
 */
export function IncomeReport({
  filters,
  income,
  rows,
  before,
}: {
  filters: ReportFilters;
  income: ReportIncome;
  rows: readonly OutRow[];
  before: IncomeBefore;
}) {
  const when = within(filters.period);
  const totals = incomeTotals(income, rows);
  if (totals.moneyIn.total === 0 && totals.out.count === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        Nothing came in or went out {when}.
      </p>
    );
  }

  const beforeTotals = incomeTotals(before.income, before.rows);
  const beforeLabel = comparisonLabel(before.period);
  const compared = beforeTotals.moneyIn.total > 0 || beforeTotals.out.count > 0;
  const change = (current: number, earlier: number) =>
    compared ? <ChangeLine current={current} before={earlier} label={beforeLabel} /> : undefined;

  const byPaidDate = filters.basis === "paid";
  const outLabel = byPaidDate ? "Paid out" : "Spent";
  const youth = youthSummary(income.youth);
  const beforeYouth = youthSummary(before.income.youth);
  const { tithes } = youth;
  const months = titheMonths(income.youth, filters.period);
  const methods = tithes.byMethod
    .filter((method) => method.count > 0)
    .sort((a, b) => b.total - a.total || b.count - a.count)
    .map(({ method, count, total }) => ({ key: method, label: INCOME_METHOD_LABELS[method], count, cents: total }));

  return (
    <div className="space-y-6">
      <section aria-labelledby="income-totals-heading" className="@container space-y-3">
        <Heading id="income-totals-heading" title="Money in and out">
          <p className="text-sm text-muted-foreground">
            Money that came in, and {byPaidDate ? "requests paid" : "approved and paid requests bought"}, {when}
          </p>
          {filters.allStatuses && !byPaidDate && (
            <p className="text-sm text-muted-foreground">Other statuses weren&apos;t spent, so they stay out here.</p>
          )}
          <p className="text-sm text-muted-foreground">
            {compared ? `Compared with ${beforeLabel}` : `Nothing in or out in ${beforeLabel} to compare with`}
          </p>
        </Heading>
        <dl className="grid divide-y rounded-lg border @md:grid-cols-3 @md:divide-x @md:divide-y-0">
          <Cell
            label="Money in"
            cents={totals.moneyIn.total}
            detail="Tithes, events, and cafe sales"
            change={change(totals.moneyIn.total, beforeTotals.moneyIn.total)}
          />
          <Cell
            label={outLabel}
            cents={totals.out.total}
            detail={requestCount(totals.out.count)}
            change={change(totals.out.total, beforeTotals.out.total)}
          />
          <Cell
            label="Left"
            cents={totals.left}
            detail={totals.left < 0 ? "More went out than came in" : `Money in minus ${outLabel.toLowerCase()}`}
            change={change(totals.left, beforeTotals.left)}
          />
        </dl>
      </section>

      <section aria-labelledby="income-profit-heading" className="@container space-y-3">
        <Heading id="income-profit-heading" title="Profit">
          <p className="text-sm text-muted-foreground">What each type took in, minus its own requests</p>
        </Heading>
        <dl className="grid divide-y rounded-lg border @md:grid-cols-2 @md:divide-x @md:divide-y-0">
          {REQUEST_TYPES.map((type) => (
            <Cell
              key={type}
              label={REQUEST_TYPE_LABELS[type]}
              swatch={TYPE_CHART_CONFIG[type].color}
              cents={totals.profit[type]}
              detail={`${formatCents(totals.moneyIn[type])} in · ${formatCents(totals.out[type])} out`}
              change={change(totals.profit[type], beforeTotals.profit[type])}
            />
          ))}
        </dl>
      </section>

      <section aria-labelledby="income-youth-heading" className="@container space-y-3">
        <Heading id="income-youth-heading" title="Tithes and events">
          <p className="text-sm text-muted-foreground">
            Stats are per tithe, not per person. Who gave is never recorded, and events stay out of the tithe
            stats.
          </p>
        </Heading>
        <dl className="grid divide-y rounded-lg border @md:grid-cols-3 @md:divide-x @md:divide-y-0">
          <Cell
            label="Tithes"
            cents={tithes.total}
            detail={plural(tithes.count, "tithe", "tithes")}
            change={change(tithes.total, beforeYouth.tithes.total)}
          />
          {tithes.average === null ? (
            <div className="flex items-start justify-between gap-3 px-4 py-3 @md:flex-col @md:justify-start @md:gap-1">
              <dt className="text-sm">Average tithe</dt>
              <dd className="text-right text-sm text-muted-foreground @md:text-left">No tithes {when}</dd>
            </div>
          ) : (
            <Cell
              label="Average tithe"
              cents={tithes.average}
              detail={`Middle tithe ${formatCents(tithes.median ?? 0)}`}
            />
          )}
          <Cell
            label="Events"
            cents={youth.events.total}
            detail={plural(youth.events.count, "event", "events")}
            change={change(youth.events.total, beforeYouth.events.total)}
          />
        </dl>
      </section>

      <div className="grid gap-6 @4xl/main:grid-cols-2 @4xl/main:items-start">
        <Breakdown
          id="income-methods"
          title="How tithes came in"
          description="Tithes only, since an event's money can come in more than one way"
          items={methods}
          detail={(item) => plural(item.count, "tithe", "tithes")}
          empty={`No tithes ${when}.`}
        />
        {/* One month would be a single bar. */}
        {months.length > 1 && tithes.count > 0 && <TitheChart months={months} />}
      </div>
    </div>
  );
}

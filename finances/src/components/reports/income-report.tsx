import { TYPE_CHART_CONFIG } from "@/components/dashboard/chart-config";
import { plural } from "@/components/income/stat";
import { Breakdown, requestCount } from "@/components/reports/breakdown";
import { ChangeLine } from "@/components/reports/change-line";
import { TitheChart } from "@/components/reports/tithe-chart";
import { Cell, Cells, EmptyCell, Heading, within } from "@/components/reports/totals";
import type { Period } from "@/lib/dates";
import { INCOME_METHOD_LABELS } from "@/lib/income/schema";
import { youthSummary } from "@/lib/income/stats";
import { formatCents } from "@/lib/money";
import { comparisonLabel } from "@/lib/reports/comparison";
import type { ReportFilters } from "@/lib/reports/filters";
import { hasMoney, incomeTotals, titheMonths, type OutRow, type ReportIncome } from "@/lib/reports/income";

/** The period before, to compare the Income tab with. */
export type IncomeBefore = { period: Period; income: ReportIncome; rows: readonly OutRow[] };

/**
 * The Income tab: the period's income and where it came from, the tithes,
 * and the money that reached the bank against the report's requests. Income
 * counts by the day it came in, or the Sunday a cafe week ends, whatever the
 * requests are counted by.
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
  if (!hasMoney(totals)) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        Nothing came in or went out {when}.
      </p>
    );
  }

  const beforeTotals = incomeTotals(before.income, before.rows);
  const beforeLabel = comparisonLabel(before.period);
  const compared = hasMoney(beforeTotals);
  const change = (current: number, earlier: number) =>
    compared ? <ChangeLine current={current} before={earlier} label={beforeLabel} /> : undefined;

  const byPaidDate = filters.basis === "paid";
  const outLabel = byPaidDate ? "Paid out" : "Spent";
  const youth = youthSummary(income.youth);
  const beforeYouth = youthSummary(before.income.youth);
  const { tithes, events } = youth;
  const discountWeeks = income.weeks.filter((week) => week.discounts_cents !== 0).length;
  const giftCards = income.paybacks.filter((payback) => payback.kind === "gift_cards").length;
  const sources = [
    { key: "tithes", label: "Tithes", count: tithes.count, cents: tithes.total, detail: plural(tithes.count, "tithe", "tithes") },
    { key: "events", label: "Events", count: events.count, cents: events.total, detail: plural(events.count, "event", "events") },
    {
      key: "square",
      label: "Cafe, from Square",
      count: income.weeks.length,
      cents: totals.income.square,
      detail: plural(income.weeks.length, "week", "weeks"),
    },
    {
      key: "discounts",
      label: "Cafe discounts",
      count: discountWeeks,
      cents: totals.income.discounts,
      detail: `${plural(discountWeeks, "week", "weeks")}, paid back by the church`,
    },
    {
      key: "gift-cards",
      label: "Cafe gift cards",
      count: giftCards,
      cents: totals.income.giftCards,
      detail: `${plural(giftCards, "payment", "payments")} from the church`,
    },
  ]
    .filter((source) => source.cents !== 0)
    .sort((a, b) => b.cents - a.cents);
  const months = titheMonths(income.youth, filters.period);
  const methods = tithes.byMethod
    .filter((method) => method.count > 0)
    .sort((a, b) => b.total - a.total || b.count - a.count)
    .map(({ method, count, total }) => ({ key: method, label: INCOME_METHOD_LABELS[method], count, cents: total }));

  return (
    <div className="space-y-6">
      <section aria-labelledby="income-totals-heading" className="@container space-y-3">
        <Heading id="income-totals-heading" title="Income">
          <p className="text-sm text-muted-foreground">All income {when}, before expenses</p>
          <p className="text-sm text-muted-foreground">
            {compared ? `Compared with ${beforeLabel}` : `Nothing in ${beforeLabel} to compare with`}
          </p>
        </Heading>
        <Cells>
          <Cell
            size="lg"
            label="Total income"
            cents={totals.income.total}
            change={change(totals.income.total, beforeTotals.income.total)}
          />
          <Cell
            label="Cafe"
            swatch={TYPE_CHART_CONFIG.cafe.color}
            cents={totals.income.cafe}
            detail="Square, discounts, and gift cards"
            change={change(totals.income.cafe, beforeTotals.income.cafe)}
          />
          <Cell
            label="Youth"
            swatch={TYPE_CHART_CONFIG.youth.color}
            cents={totals.income.youth}
            detail="Tithes and events"
            change={change(totals.income.youth, beforeTotals.income.youth)}
          />
        </Cells>
      </section>

      <Breakdown
        id="income-sources"
        title="Income by source"
        description="Where the period's income came from"
        items={sources}
        detail={(source) => source.detail}
        empty={`No income ${when}.`}
      />

      <section aria-labelledby="income-youth-heading" className="@container space-y-3">
        <Heading id="income-youth-heading" title="Tithes and events">
          <p className="text-sm text-muted-foreground">
            Stats are per tithe, not per person. Who gave is never recorded, and events stay out of the tithe
            stats.
          </p>
        </Heading>
        <Cells>
          <Cell
            label="Tithes"
            cents={tithes.total}
            detail={plural(tithes.count, "tithe", "tithes")}
            change={change(tithes.total, beforeYouth.tithes.total)}
          />
          {tithes.average === null ? (
            <EmptyCell label="Average tithe">No tithes {when}</EmptyCell>
          ) : (
            <Cell
              label="Average tithe"
              cents={tithes.average}
              detail={`Middle tithe ${formatCents(tithes.median ?? 0)}`}
            />
          )}
          <Cell
            label="Events"
            cents={events.total}
            detail={plural(events.count, "event", "events")}
            change={change(events.total, beforeYouth.events.total)}
          />
        </Cells>
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

      <section aria-labelledby="income-cash-heading" className="@container space-y-3">
        <Heading id="income-cash-heading" title="Money in and out">
          <p className="text-sm text-muted-foreground">
            What reached the bank {when}. Church paybacks count the day they came in, not when the discounts were
            given, so this can differ from profit.
          </p>
          {filters.allStatuses && !byPaidDate && (
            <p className="text-sm text-muted-foreground">Other statuses weren&apos;t spent, so they stay out here.</p>
          )}
        </Heading>
        <Cells>
          <Cell
            label="Money in"
            cents={totals.moneyIn.total}
            detail={
              totals.moneyIn.paybacks > 0
                ? `Tithes, events, the cafe, and ${formatCents(totals.moneyIn.paybacks)} in church paybacks`
                : "Tithes, events, and the cafe from Square"
            }
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
        </Cells>
      </section>
    </div>
  );
}

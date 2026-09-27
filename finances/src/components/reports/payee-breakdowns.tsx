"use client";

import { useState } from "react";
import Link from "next/link";
import { TYPE_CHART_CONFIG } from "@/components/dashboard/chart-config";
import { Breakdown, labeled, requestCount } from "@/components/reports/breakdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { sharePercent } from "@/lib/dashboard/summary";
import { periodLabel } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { REQUEST_TYPE_LABELS } from "@/lib/requests/format";
import { REQUEST_TYPES } from "@/lib/requests/schema";
import type { PayeeTotals, ReportFilters, ReportTotals } from "@/lib/reports/filters";
import { newPayeeBreakdown, PAYEE_GROUP_LABELS, payeeAverage, TOP_PAYEES, topPayees } from "@/lib/reports/payees";

function payeeCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "payee" : "payees"}`;
}

/** What makes a payee new, in the report's own terms. */
function newDescription(filters: ReportFilters): string {
  const label = periodLabel(filters.period);
  const when = filters.period.kind === "custom" ? label : `in ${label}`;
  if (filters.basis === "paid") return `New payees were first paid ${when}`;
  return `New payees' first ${filters.allStatuses ? "" : "approved or paid "}request was bought ${when}`;
}

/**
 * The Payees tab: how many payees and the average per payee, how many are
 * new, and each payee's total split into cafe and youth.
 */
export function PayeeBreakdowns({
  payees,
  totals,
  returning,
  filters,
}: {
  payees: PayeeTotals[];
  totals: ReportTotals;
  /** Payees with a request the report would count from before its period. */
  returning: ReadonlySet<string>;
  filters: ReportFilters;
}) {
  const average = payeeAverage(payees);
  return (
    <div className="grid gap-6 @4xl/main:grid-cols-2 @4xl/main:items-start">
      <div className="space-y-6">
        <section aria-labelledby="report-payee-summary-heading" className="space-y-3">
          <h2 id="report-payee-summary-heading" className="sr-only">
            Payee summary
          </h2>
          <dl className="grid grid-cols-2 divide-x rounded-lg border">
            <div className="space-y-1 px-4 py-3">
              <dt className="text-sm">Payees</dt>
              <dd className="tabular-nums">
                <span className="block font-semibold">{payees.length.toLocaleString()}</span>
                <span className="block text-sm text-muted-foreground">{requestCount(totals.count)}</span>
              </dd>
            </div>
            <div className="space-y-1 px-4 py-3">
              <dt className="text-sm">Average per payee</dt>
              <dd className="tabular-nums">
                <span className="block font-semibold">{formatCents(average.cents)}</span>
                <span className="block text-sm text-muted-foreground">
                  {average.requests.toLocaleString(undefined, { maximumFractionDigits: 1 })}{" "}
                  {average.requests === 1 ? "request" : "requests"} each
                </span>
              </dd>
            </div>
          </dl>
        </section>
        <Breakdown
          id="report-new-payees"
          title="New and returning"
          description={newDescription(filters)}
          items={labeled(newPayeeBreakdown(payees, returning), PAYEE_GROUP_LABELS)}
          detail={(item) => `${payeeCount(item.payees)} · ${requestCount(item.count)}`}
        />
      </div>
      <PayeeTotalsSection payees={payees} totalCents={totals.cents} returning={returning} />
    </div>
  );
}

/** Which color is cafe and which is youth. The bars are hidden from screen readers, so this is too. */
function TypeLegend() {
  return (
    <ul aria-hidden className="flex gap-4 text-sm text-muted-foreground">
      {REQUEST_TYPES.map((type) => (
        <li key={type} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: TYPE_CHART_CONFIG[type].color }} />
          {REQUEST_TYPE_LABELS[type]}
        </li>
      ))}
    </ul>
  );
}

/** A total as a bar against the biggest one shown, split into cafe and youth. */
function TypeBar({ totals, most }: { totals: ReportTotals; most: number }) {
  return (
    <span aria-hidden className="flex h-2 gap-px overflow-hidden rounded-full bg-muted">
      {REQUEST_TYPES.map((type) => {
        const cents = totals.byType[type].cents;
        if (cents <= 0 || most <= 0) return null;
        return (
          <span
            key={type}
            className="h-full"
            style={{ width: `${Math.max(1, (cents / most) * 100)}%`, backgroundColor: TYPE_CHART_CONFIG[type].color }}
          />
        );
      })}
    </span>
  );
}

/** The cafe and youth split in words, for screen readers. */
function typeSplit(totals: ReportTotals): string {
  return REQUEST_TYPES.filter((type) => totals.byType[type].cents > 0)
    .map((type) => `${REQUEST_TYPE_LABELS[type]} ${formatCents(totals.byType[type].cents)}`)
    .join(", ");
}

/**
 * Each payee's total and share, biggest first, linking to the payee, with a
 * bar split into cafe and youth. A long list shows the top payees and adds
 * up everyone else until it's opened.
 */
function PayeeTotalsSection({
  payees,
  totalCents,
  returning,
}: {
  payees: PayeeTotals[];
  totalCents: number;
  returning: ReadonlySet<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const { top, rest } = topPayees(payees);
  const shown = expanded ? payees : top;
  const others = expanded ? null : rest;
  const most = Math.max(0, ...shown.map((payee) => payee.cents), others?.cents ?? 0);

  return (
    <section aria-labelledby="report-payees-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h2 id="report-payees-heading" className="text-lg font-semibold">
            By payee
          </h2>
          <p className="text-sm text-muted-foreground">{payeeCount(payees.length)}, most paid first</p>
        </div>
        <TypeLegend />
      </div>
      <ul id="report-payee-totals" className="divide-y rounded-lg border">
        {shown.map((payee) => (
          <li key={payee.payeeId}>
            <Link
              href={`/admin/payees/${payee.payeeId}`}
              className="block space-y-2 px-4 py-3 outline-none hover:bg-muted focus-visible:bg-muted"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">{payee.name}</span>
                  {!returning.has(payee.payeeId) && <Badge variant="secondary">New</Badge>}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{formatCents(payee.cents)}</span>
              </span>
              <TypeBar totals={payee} most={most} />
              <span className="block text-sm text-muted-foreground tabular-nums">
                {requestCount(payee.count)} · {sharePercent(payee.cents, totalCents)}
                <span className="sr-only">. {typeSplit(payee)}</span>
              </span>
            </Link>
          </li>
        ))}
        {others && (
          <li className="space-y-2 px-4 py-3">
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">Everyone else</span>
              <span className="shrink-0 font-semibold tabular-nums">{formatCents(others.cents)}</span>
            </span>
            <TypeBar totals={others} most={most} />
            <span className="block text-sm text-muted-foreground tabular-nums">
              {payeeCount(others.payees)} · {requestCount(others.count)} · {sharePercent(others.cents, totalCents)}
              <span className="sr-only">. {typeSplit(others)}</span>
            </span>
          </li>
        )}
      </ul>
      {rest && (
        <Button
          variant="outline"
          className="h-11 w-full"
          aria-controls="report-payee-totals"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? `Show the top ${TOP_PAYEES}` : `Show all ${payees.length} payees`}
        </Button>
      )}
    </section>
  );
}

import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import type { DashboardSummary } from "@/lib/dashboard/summary";
import { periodLabel } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { DEFAULT_QUEUE_FILTERS, queueHref } from "@/lib/requests/queue";

function requestCount(count: number): string {
  return count === 1 ? "1 request" : `${count} requests`;
}

/** A card that opens a queue tab. */
function QueueCard({ href, label, value, note }: { href: string; label: string; value: string; note: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-16 flex-col gap-1 rounded-lg border px-4 py-3 outline-none hover:bg-muted focus-visible:bg-muted"
    >
      <span className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        {label}
        <ChevronRightIcon className="size-4 shrink-0" aria-hidden />
      </span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
      <span className="text-sm text-muted-foreground">{note}</span>
    </Link>
  );
}

/** What needs doing, then what's been paid this month, quarter, and year. */
export function SummaryCards({ summary }: { summary: DashboardSummary }) {
  const { awaitingReview, toPay, paid } = summary;
  const periods = [
    { label: "This month", ...paid.month },
    { label: "This quarter", ...paid.quarter },
    { label: "This year", ...paid.year },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <QueueCard
          href={queueHref({ ...DEFAULT_QUEUE_FILTERS, tab: "review" })}
          label="Awaiting review"
          value={String(awaitingReview)}
          note={awaitingReview === 1 ? "request" : "requests"}
        />
        <QueueCard
          href={queueHref({ ...DEFAULT_QUEUE_FILTERS, tab: "pay" })}
          label="To pay"
          value={formatCents(toPay.cents)}
          note={requestCount(toPay.count)}
        />
      </div>

      <section aria-labelledby="paid-heading" className="space-y-3">
        <div>
          <h2 id="paid-heading" className="text-lg font-semibold">
            Paid
          </h2>
          <p className="text-sm text-muted-foreground">By the date each request was paid.</p>
        </div>
        <dl className="divide-y rounded-lg border md:grid md:grid-cols-3 md:divide-x md:divide-y-0">
          {periods.map(({ label, period, cents }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3 px-4 py-3 md:flex-col md:items-start md:justify-start md:gap-1"
            >
              <dt>
                <span className="block font-medium">{label}</span>
                <span className="block text-sm text-muted-foreground">{periodLabel(period)}</span>
              </dt>
              <dd className="text-lg font-semibold tabular-nums">{formatCents(cents)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}

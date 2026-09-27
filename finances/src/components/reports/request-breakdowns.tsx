import { sharePercent } from "@/lib/dashboard/summary";
import { formatCents } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/requests/actions";
import { REQUEST_STATUS_LABELS } from "@/lib/requests/format";
import type { ReportRow } from "@/lib/requests/queries";
import {
  paymentMethodBreakdown,
  RECEIPT_GROUP_LABELS,
  receiptBreakdown,
  SIZE_BAND_LABELS,
  sizeBreakdown,
  statusBreakdown,
  type Slice,
} from "@/lib/reports/breakdowns";
import type { ReportFilters } from "@/lib/reports/filters";

function requestCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "request" : "requests"}`;
}

function labeled<Key extends string>(slices: Slice<Key>[], labels: Record<Key, string>) {
  return slices.map((slice) => ({ ...slice, label: labels[slice.key] }));
}

type BreakdownItem = Slice<string> & { label: string };

/**
 * One group per row, with a bar for its share like the dashboard's top
 * payees. The numbers are always showing, so there's no chart to tap. Most
 * go by amount; `by="count"` goes by how many requests.
 */
function Breakdown({
  id,
  title,
  description,
  items,
  by = "amount",
  empty,
}: {
  id: string;
  title: string;
  description: string;
  items: BreakdownItem[];
  by?: "amount" | "count";
  empty?: string;
}) {
  const measure = (item: BreakdownItem) => (by === "count" ? item.count : item.cents);
  const total = items.reduce((sum, item) => sum + measure(item), 0);

  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-3">
      <div>
        <h2 id={`${id}-heading`} className="text-lg font-semibold">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {items.length > 0 ? (
        <dl className="divide-y rounded-lg border">
          {items.map((item) => {
            const value = measure(item);
            return (
              <div key={item.key} className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-2 px-4 py-3">
                <dt className="min-w-0 truncate text-sm font-medium">{item.label}</dt>
                <dd className="font-semibold tabular-nums">
                  {by === "count" ? requestCount(item.count) : formatCents(item.cents)}
                </dd>
                <dd className="col-span-2 space-y-2">
                  <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${value > 0 ? Math.max(2, (value / total) * 100) : 0}%` }}
                    />
                  </span>
                  <span className="block text-sm text-muted-foreground tabular-nums">
                    {by === "count" ? formatCents(item.cents) : requestCount(item.count)} · {sharePercent(value, total)}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

/**
 * The Requests tab's breakdowns: by status, size, receipts, and how they
 * were paid. By paid date every request is paid, so status is left out.
 */
export function RequestBreakdowns({ rows, filters }: { rows: ReportRow[]; filters: ReportFilters }) {
  const byPaidDate = filters.basis === "paid";
  return (
    <div className="grid gap-6 @4xl/main:grid-cols-2 @4xl/main:items-start">
      {!byPaidDate && (
        <Breakdown
          id="report-statuses"
          title="By status"
          description="Where each request is now"
          items={labeled(statusBreakdown(rows), REQUEST_STATUS_LABELS)}
        />
      )}
      <Breakdown
        id="report-sizes"
        title="By size"
        description="How many requests fall in each range"
        by="count"
        items={labeled(sizeBreakdown(rows), SIZE_BAND_LABELS)}
      />
      <Breakdown
        id="report-receipts"
        title="Receipts"
        description="Missing means a receipt has no file, or “No receipt” is checked"
        items={labeled(receiptBreakdown(rows), RECEIPT_GROUP_LABELS)}
      />
      <Breakdown
        id="report-methods"
        title="How they were paid"
        description={byPaidDate ? "Every request here is paid" : "Paid requests only"}
        items={labeled(paymentMethodBreakdown(rows), PAYMENT_METHOD_LABELS)}
        empty="Nothing in this report has been paid yet."
      />
    </div>
  );
}

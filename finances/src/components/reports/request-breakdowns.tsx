import type { ReactNode } from "react";
import { Breakdown, labeled } from "@/components/reports/breakdown";
import { PAYMENT_METHOD_LABELS } from "@/lib/requests/actions";
import { REQUEST_STATUS_LABELS } from "@/lib/requests/format";
import type { ReportRow } from "@/lib/requests/queries";
import {
  eventBreakdown,
  paymentMethodBreakdown,
  RECEIPT_GROUP_LABELS,
  receiptBreakdown,
  SIZE_BAND_LABELS,
  sizeBreakdown,
  statusBreakdown,
  vendorBreakdown,
} from "@/lib/reports/breakdowns";
import type { ReportFilters } from "@/lib/reports/filters";

function receiptCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "receipt" : "receipts"}`;
}

/** One breakdown, kept whole instead of split across the two columns. */
function Cell({ children }: { children: ReactNode }) {
  // Padding, not margins, spaces the cells, since a margin at the top of a
  // column can be dropped.
  return <div className="break-inside-avoid pb-6 last:pb-0">{children}</div>;
}

/**
 * The Requests tab's breakdowns: by status, size, receipts, how they were
 * paid, vendor, and event. By paid date every request is paid, so status is
 * left out. On a wide screen they flow down two columns that the browser
 * balances by height, so neither side is left with a gap however long the
 * vendor and event lists get.
 */
export function RequestBreakdowns({ rows, filters }: { rows: ReportRow[]; filters: ReportFilters }) {
  const byPaidDate = filters.basis === "paid";
  return (
    <div className="@4xl/main:columns-2 @4xl/main:gap-6">
      {!byPaidDate && (
        <Cell>
          <Breakdown
            id="report-statuses"
            title="By status"
            description="Where each request is now"
            items={labeled(statusBreakdown(rows), REQUEST_STATUS_LABELS)}
          />
        </Cell>
      )}
      <Cell>
        <Breakdown
          id="report-sizes"
          title="By size"
          description="How many requests fall in each range"
          by="count"
          items={labeled(sizeBreakdown(rows), SIZE_BAND_LABELS)}
        />
      </Cell>
      <Cell>
        <Breakdown
          id="report-receipts"
          title="Receipts"
          description="Missing means a receipt has no file, or “No receipt on file” is on"
          items={labeled(receiptBreakdown(rows), RECEIPT_GROUP_LABELS)}
        />
      </Cell>
      <Cell>
        <Breakdown
          id="report-methods"
          title="How they were paid"
          description={byPaidDate ? "Every request here is paid" : "Paid requests only"}
          items={labeled(paymentMethodBreakdown(rows), PAYMENT_METHOD_LABELS)}
          empty="Nothing in this report has been paid yet."
        />
      </Cell>
      <Cell>
        <Breakdown
          id="report-vendors"
          title="Top vendors"
          description="From each receipt, so a request from two stores counts under both"
          items={vendorBreakdown(rows)}
          detail={(item) => receiptCount(item.count)}
          empty="No receipt in this report has a vendor."
        />
      </Cell>
      <Cell>
        <Breakdown
          id="report-events"
          title="By event"
          description="What each event cost"
          items={eventBreakdown(rows)}
          empty="No request in this report is for an event."
        />
      </Cell>
    </div>
  );
}

import { Breakdown, labeled } from "@/components/reports/breakdown";
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
} from "@/lib/reports/breakdowns";
import type { ReportFilters } from "@/lib/reports/filters";

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

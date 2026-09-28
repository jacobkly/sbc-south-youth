import { MissingReceiptBadge, RequestRow, RequestTable } from "@/components/requests/request-list";
import { StatusBadge } from "@/components/requests/status-badge";
import { formatListDate, laDateOf } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { formatRequestNumber, REQUEST_TYPE_LABELS, requestTitle } from "@/lib/requests/format";
import type { ReportRow } from "@/lib/requests/queries";
import type { ReportBasis } from "@/lib/reports/filters";

/**
 * A report's requests, each linking to its detail page. Shows the date the
 * report goes by, and the type, since reports split by it.
 */
export function ReportList({
  id,
  rows,
  basis,
  showStatus,
}: {
  id?: string;
  rows: ReportRow[];
  basis: ReportBasis;
  showStatus: boolean;
}) {
  return (
    <RequestTable id={id} showPayee showStatus={showStatus} dateLabel={basis === "paid" ? "Date paid" : "Date"}>
      {rows.map((row) => {
        const paid = basis === "paid" && row.paid_at ? laDateOf(row.paid_at) : null;

        return (
          <RequestRow key={row.id} row={row} date={paid ?? row.purchase_date} showPayee showStatus={showStatus}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{row.payee?.full_name ?? "Unknown payee"}</p>
              <p className="truncate text-sm text-muted-foreground">{requestTitle(row)}</p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {formatRequestNumber(row.request_number)} ·{" "}
                {paid ? `Paid ${formatListDate(paid)}` : formatListDate(row.purchase_date)} ·{" "}
                {REQUEST_TYPE_LABELS[row.type]}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-medium tabular-nums">{formatCents(row.amount_cents)}</span>
              {showStatus && <StatusBadge status={row.status} />}
              {row.missing_receipt && <MissingReceiptBadge />}
            </div>
          </RequestRow>
        );
      })}
    </RequestTable>
  );
}

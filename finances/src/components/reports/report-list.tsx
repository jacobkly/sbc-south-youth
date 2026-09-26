import Link from "next/link";
import { StatusBadge } from "@/components/requests/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatDate, laDateOf } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { formatRequestNumber, REQUEST_TYPE_LABELS } from "@/lib/requests/format";
import type { ReportRow } from "@/lib/requests/queries";
import type { ReportBasis } from "@/lib/reports/filters";

/**
 * A report's requests as tappable cards, each linking to its detail page.
 * Shows the date the report goes by, and the type, since reports split by it.
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
    <ul id={id} className="divide-y rounded-lg border">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/admin/requests/${row.id}`}
            className="flex min-h-16 items-start gap-3 px-4 py-3 outline-none hover:bg-muted focus-visible:bg-muted"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{row.payee?.full_name ?? "Unknown payee"}</p>
              <p className="truncate text-sm text-muted-foreground">{row.vendor}</p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {formatRequestNumber(row.request_number)} ·{" "}
                {basis === "paid" && row.paid_at
                  ? `Paid ${formatDate(laDateOf(row.paid_at))}`
                  : formatDate(row.purchase_date)}{" "}
                · {REQUEST_TYPE_LABELS[row.type]}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-medium tabular-nums">{formatCents(row.amount_cents)}</span>
              {showStatus && <StatusBadge status={row.status} />}
              {row.no_receipt && <Badge variant="outline">No receipt</Badge>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

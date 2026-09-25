import { FileXIcon, TriangleAlertIcon } from "lucide-react";
import { ReceiptGallery } from "@/components/receipts/receipt-gallery";
import { StatusBadge } from "@/components/requests/status-badge";
import { StatusTimeline, type TimelineEvent } from "@/components/requests/status-timeline";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDate, laDateOf } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import type { SignedReceiptUrls } from "@/lib/receipts/signed-urls";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/requests/actions";
import { formatRequestNumber, REQUEST_TYPE_LABELS, type RequestStatus } from "@/lib/requests/format";
import type { RequestType } from "@/lib/requests/schema";

export type RequestDetailData = {
  request_number: number;
  status: RequestStatus;
  type: RequestType;
  amount_cents: number;
  purchase_date: string;
  vendor: string;
  description: string;
  event_name: string | null;
  no_receipt: boolean;
  no_receipt_reason: string | null;
  external_approver: string | null;
  paid_at: string | null;
  payment_method: PaymentMethod | null;
  payment_reference: string | null;
  payee: { full_name: string } | null;
  /** Oldest first. */
  receipts: {
    id: string;
    storage_path: string;
    original_filename: string;
    mime_type: string;
    width: number | null;
    height: number | null;
  }[];
};

export type LateWarning = {
  days: number;
  limitDays: number;
  /** Measured to when it was sent for review, not to today. */
  sent: boolean;
};

function detailRows(request: RequestDetailData): [string, string][] {
  const rows: [string, string][] = [
    ["Type", REQUEST_TYPE_LABELS[request.type]],
    ["Purchase date", formatDate(request.purchase_date)],
    ["Vendor", request.vendor],
  ];
  if (request.event_name) rows.push(["Event", request.event_name]);
  rows.push(["Description", request.description]);
  if (request.external_approver) rows.push(["Approved by", request.external_approver]);
  if (request.paid_at) {
    const method = request.payment_method && PAYMENT_METHOD_LABELS[request.payment_method];
    rows.push(
      ["Paid", formatDate(laDateOf(request.paid_at))],
      ["Paid with", [method, request.payment_reference].filter(Boolean).join(" · ") || "Not recorded"],
    );
  }
  return rows;
}

/** A request's summary, receipts, details, and history. Read-only. */
export function RequestDetail({
  request,
  events,
  payeeNames,
  signed,
  late,
}: {
  request: RequestDetailData;
  /** Oldest first. */
  events: TimelineEvent[];
  payeeNames: ReadonlyMap<string, string>;
  signed: SignedReceiptUrls | null;
  late: LateWarning | null;
}) {
  const { receipts } = request;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{formatRequestNumber(request.request_number)}</span>
          <StatusBadge status={request.status} />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight tabular-nums">{formatCents(request.amount_cents)}</h1>
        <p className="text-lg break-words">{request.payee?.full_name}</p>
      </div>

      {late && (
        <Alert role="note">
          <TriangleAlertIcon />
          <AlertTitle>Late</AlertTitle>
          <AlertDescription>
            {late.sent ? `Sent ${late.days} days after purchase.` : `Bought ${late.days} days ago.`} Requests are due
            within {late.limitDays} days of purchase.
          </AlertDescription>
        </Alert>
      )}

      <section aria-labelledby="receipts-heading" className="space-y-3">
        <h2 id="receipts-heading" className="text-lg font-semibold">
          Receipts
        </h2>
        {request.no_receipt && (
          <Alert role="note">
            <FileXIcon />
            <AlertTitle>No receipt on file</AlertTitle>
            <AlertDescription className="break-words whitespace-pre-wrap">{request.no_receipt_reason}</AlertDescription>
          </Alert>
        )}
        {receipts.length > 0 ? (
          <ReceiptGallery
            receipts={receipts.map((receipt) => ({
              id: receipt.id,
              path: receipt.storage_path,
              name: receipt.original_filename,
              mimeType: receipt.mime_type,
              width: receipt.width,
              height: receipt.height,
            }))}
            initial={signed}
          />
        ) : (
          !request.no_receipt && <p className="text-muted-foreground">No receipts yet.</p>
        )}
      </section>

      <section aria-labelledby="details-heading" className="space-y-3">
        <h2 id="details-heading" className="text-lg font-semibold">
          Details
        </h2>
        <dl className="divide-y rounded-lg border">
          {detailRows(request).map(([term, value]) => (
            <div key={term} className="space-y-1 px-4 py-3">
              <dt className="text-sm text-muted-foreground">{term}</dt>
              <dd className="break-words whitespace-pre-wrap">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="history-heading" className="space-y-3">
        <h2 id="history-heading" className="text-lg font-semibold">
          History
        </h2>
        <StatusTimeline events={events} payeeNames={payeeNames} />
      </section>
    </div>
  );
}

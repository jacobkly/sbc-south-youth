import type { ReactNode } from "react";
import Link from "next/link";
import { FileXIcon, PencilIcon, TriangleAlertIcon } from "lucide-react";
import { BackLink } from "@/components/nav/back-link";
import { ReceiptGallery } from "@/components/receipts/receipt-gallery";
import { StatusBadge } from "@/components/requests/status-badge";
import { StatusTimeline, type TimelineEvent } from "@/components/requests/status-timeline";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  vendor: string | null;
  description: string | null;
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

/** Each detail and its value. A null value wasn't recorded. */
function detailRows(request: RequestDetailData): [string, string | null][] {
  const rows: [string, string | null][] = [
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
      ["Paid with", [method, request.payment_reference].filter(Boolean).join(" · ") || null],
    );
  }
  return rows;
}

/** A request's summary, receipts, details, and history, with room for the actions an admin can take. */
export function RequestDetail({
  request,
  events,
  payeeNames,
  signed,
  late,
  actions,
  editHref,
}: {
  request: RequestDetailData;
  /** Oldest first. */
  events: TimelineEvent[];
  payeeNames: ReadonlyMap<string, string>;
  signed: SignedReceiptUrls | null;
  late: LateWarning | null;
  /** Shown under the summary. Left out for anyone who can only view. */
  actions?: ReactNode;
  /** Where to edit it, while it can still be edited by this user. */
  editHref?: string;
}) {
  const { receipts } = request;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <BackLink fallbackHref="/admin/requests" fallbackLabel="Requests" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{formatRequestNumber(request.request_number)}</span>
              <StatusBadge status={request.status} />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight tabular-nums">{formatCents(request.amount_cents)}</h1>
            <p className="text-lg break-words">{request.payee?.full_name}</p>
          </div>
          {editHref && (
            <Button variant="outline" className="h-11 shrink-0" asChild>
              <Link href={editHref}>
                <PencilIcon aria-hidden />
                Edit
              </Link>
            </Button>
          )}
        </div>
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

      {actions}

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
              <dd className="break-words whitespace-pre-wrap">
                {value ?? <span className="text-muted-foreground">Not recorded</span>}
              </dd>
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

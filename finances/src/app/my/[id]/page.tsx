import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequestActions } from "@/components/requests/request-actions";
import { RequestDetail } from "@/components/requests/request-detail";
import { getCurrentPayeeId, getCurrentUser } from "@/lib/auth/current-user";
import { signReceiptUrls } from "@/lib/receipts/signed-urls";
import { isEditableByRequester } from "@/lib/requests/format";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Request",
};

// No payee: it's always them. Requesters can't read payees anyway.
const REQUEST_COLUMNS = `
  request_number, status, type, amount_cents, purchase_date, vendor, description, event_name,
  no_receipt, no_receipt_reason, external_approver, paid_at, payment_method, payment_reference, created_by, payee_id,
  lines:request_lines(id, amount_cents, vendor),
  receipts(id, line_id, storage_path, original_filename, mime_type, width, height),
  request_events(id, action, from_status, note, changes, created_at, actor:users(full_name))
`;

/** Names for payees an edit mentions. A requester can't read payees, so changes show without them. */
const NO_PAYEE_NAMES: ReadonlyMap<string, string> = new Map();

export default async function MyRequestPage({ params }: PageProps<"/my/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const [{ data: request, error }, payeeId, user] = await Promise.all([
    supabase
      .from("reimbursement_requests")
      .select(REQUEST_COLUMNS)
      .eq("id", id)
      .order("position", { referencedTable: "lines" })
      .order("created_at", { referencedTable: "receipts" })
      .order("created_at", { referencedTable: "request_events" })
      .order("id", { referencedTable: "request_events" })
      .maybeSingle(),
    getCurrentPayeeId(),
    getCurrentUser(),
  ]);

  // Handled by my/error.tsx.
  if (error) throw error;
  // An owner or viewer can read other people's requests too, but this page is only for their own.
  if (!request || !payeeId || request.payee_id !== payeeId) notFound();

  const { request_events: events, ...details } = request;
  const signed = await signReceiptUrls(
    supabase,
    details.receipts.map((receipt) => receipt.storage_path),
  );

  // The status functions check the role and payee again.
  const actions = (
    <RequestActions
      request={{
        id,
        requestNumber: details.request_number,
        status: details.status,
        amountCents: details.amount_cents,
        payeeName: "you",
        purchaseDate: details.purchase_date,
        receiptCount: details.receipts.length,
        noReceipt: details.no_receipt,
      }}
      selfPayee
      enteredBySelf={details.created_by === user?.id}
      allowExternalApproval={false}
      requester
    />
  );

  return (
    <RequestDetail
      request={details}
      events={events}
      payeeNames={NO_PAYEE_NAMES}
      signed={signed}
      late={null}
      actions={actions}
      editHref={isEditableByRequester(details.status) ? `/my/${id}/edit` : undefined}
      backHref="/my"
      backLabel="My requests"
    />
  );
}

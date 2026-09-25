import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequestActions } from "@/components/requests/request-actions";
import { RequestDetail } from "@/components/requests/request-detail";
import { getCurrentUser } from "@/lib/auth/current-user";
import { todayInLA } from "@/lib/dates";
import { signReceiptUrls } from "@/lib/receipts/signed-urls";
import { lateSubmissionDays } from "@/lib/requests/actions";
import { changedPayeeIds, lateCheckDate } from "@/lib/requests/status";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Request",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REQUEST_COLUMNS = `
  request_number, status, type, amount_cents, purchase_date, vendor, description, event_name,
  no_receipt, no_receipt_reason, external_approver, paid_at, payment_method, payment_reference, created_by,
  payee:payees(full_name, user_id),
  receipts(id, storage_path, original_filename, mime_type, width, height),
  request_events(id, action, from_status, note, changes, created_at, actor:users(full_name))
`;

export default async function RequestPage({ params }: PageProps<"/admin/requests/[id]">) {
  const { id } = await params;
  // A malformed id would be a database error, not a missing request.
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: request, error }, { data: settings, error: settingsError }, user] = await Promise.all([
    supabase
      .from("reimbursement_requests")
      .select(REQUEST_COLUMNS)
      .eq("id", id)
      .order("created_at", { referencedTable: "receipts" })
      .order("created_at", { referencedTable: "request_events" })
      .order("id", { referencedTable: "request_events" })
      .maybeSingle(),
    supabase.from("app_settings").select("late_submission_days, allow_external_approval").eq("id", 1).single(),
    getCurrentUser(),
  ]);

  // Handled by admin/error.tsx.
  if (error) throw error;
  if (settingsError) throw settingsError;
  if (!request) notFound();

  const { request_events: events, ...details } = request;
  const payeeIds = changedPayeeIds(events);

  const [signed, payeeNames] = await Promise.all([
    signReceiptUrls(
      supabase,
      details.receipts.map((receipt) => receipt.storage_path),
    ),
    payeeIds.length === 0
      ? new Map<string, string>()
      : supabase
          .from("payees")
          .select("id, full_name")
          .in("id", payeeIds)
          .then(({ data, error }) => {
            if (error) throw error;
            return new Map(data.map((payee) => [payee.id, payee.full_name]));
          }),
  ]);

  const limitDays = settings.late_submission_days;
  const lateCheck = lateCheckDate(details.status, events, todayInLA());
  const lateDays = lateCheck && lateSubmissionDays(details.purchase_date, lateCheck.date, limitDays);

  // Viewers only look. The status functions check the role again.
  const actions = user?.role === "admin" && (
    <RequestActions
      request={{
        id,
        requestNumber: details.request_number,
        status: details.status,
        amountCents: details.amount_cents,
        payeeName: details.payee?.full_name ?? "",
        purchaseDate: details.purchase_date,
        receiptCount: details.receipts.length,
        noReceipt: details.no_receipt,
      }}
      selfPayee={details.payee?.user_id === user.id}
      enteredBySelf={details.created_by === user.id}
      allowExternalApproval={settings.allow_external_approval}
    />
  );

  return (
    <RequestDetail
      request={details}
      events={events}
      payeeNames={payeeNames}
      signed={signed}
      late={lateCheck && lateDays !== null ? { days: lateDays, limitDays, sent: lateCheck.sent } : null}
      actions={actions}
    />
  );
}

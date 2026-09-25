import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EditRequestForm } from "@/components/requests/edit-request-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { todayInLA } from "@/lib/dates";
import { centsToDecimal } from "@/lib/money";
import { PAYEE_COLUMNS } from "@/lib/payees/columns";
import { signReceiptUrls } from "@/lib/receipts/signed-urls";
import { recentEventNames } from "@/lib/requests/event-names";
import { isEditable } from "@/lib/requests/format";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Edit request",
};

const REQUEST_COLUMNS = `
  request_number, status, created_by, payee_id, type, amount_cents, purchase_date, vendor, description,
  event_name, no_receipt, no_receipt_reason,
  payee:payees(full_name),
  receipts(id, storage_path, original_filename, mime_type, width, height)
`;

export default async function EditRequestPage({ params }: PageProps<"/admin/requests/[id]/edit">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const detailHref = `/admin/requests/${id}`;

  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect(detailHref);

  const supabase = await createClient();
  const [{ data: request, error }, events] = await Promise.all([
    supabase
      .from("reimbursement_requests")
      .select(REQUEST_COLUMNS)
      .eq("id", id)
      .order("created_at", { referencedTable: "receipts" })
      .maybeSingle(),
    supabase
      .from("reimbursement_requests")
      .select("event_name")
      .not("event_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  // Handled by admin/error.tsx.
  if (error) throw error;
  if (events.error) throw events.error;
  if (!request) notFound();
  // Approved and closed requests change only through their actions.
  if (!isEditable(request.status)) redirect(detailHref);

  const [payees, signed] = await Promise.all([
    // Its payee stays pickable even if they've been deactivated since.
    supabase
      .from("payees")
      .select(PAYEE_COLUMNS)
      .or(`is_active.eq.true,id.eq.${request.payee_id}`)
      .order("full_name"),
    signReceiptUrls(
      supabase,
      request.receipts.map((receipt) => receipt.storage_path),
    ),
  ]);
  if (payees.error) throw payees.error;

  return (
    <EditRequestForm
      request={{
        id,
        requestNumber: request.request_number,
        status: request.status,
        values: {
          payee_id: request.payee_id,
          type: request.type,
          amount: centsToDecimal(request.amount_cents),
          purchase_date: request.purchase_date,
          vendor: request.vendor,
          description: request.description,
          event_name: request.event_name ?? "",
          no_receipt: request.no_receipt,
          no_receipt_reason: request.no_receipt_reason ?? "",
        },
        amountCents: request.amount_cents,
        payeeName: request.payee?.full_name ?? "",
        receipts: request.receipts.map((receipt) => ({
          id: receipt.id,
          path: receipt.storage_path,
          name: receipt.original_filename,
          mimeType: receipt.mime_type,
          width: receipt.width,
          height: receipt.height,
        })),
        signed,
      }}
      payees={payees.data}
      eventNames={recentEventNames(events.data)}
      today={todayInLA()}
      deletableBy={request.status === "draft" && request.created_by === user.id ? user.id : null}
    />
  );
}

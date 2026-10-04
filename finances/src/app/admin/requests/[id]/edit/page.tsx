import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { NarrowPage } from "@/components/nav/app-shell";
import { EditRequestForm } from "@/components/requests/edit-request-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { todayInLA } from "@/lib/dates";
import { PAYEE_COLUMNS } from "@/lib/payees/columns";
import { signReceiptUrls } from "@/lib/receipts/signed-urls";
import { EDIT_REQUEST_COLUMNS, toEditableRequest } from "@/lib/requests/edit";
import { recentEventNames } from "@/lib/requests/event-names";
import { isCorrectable, isEditable } from "@/lib/requests/format";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Edit request",
};

const REQUEST_COLUMNS = `${EDIT_REQUEST_COLUMNS}, payee:payees(full_name)` as const;

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
      .order("position", { referencedTable: "lines" })
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
  // An approved or paid request can still be corrected. Closed ones change only through their actions.
  if (!isEditable(request.status) && !isCorrectable(request.status)) redirect(detailHref);

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
    <NarrowPage>
      <EditRequestForm
        request={toEditableRequest(id, request, request.payee?.full_name ?? "", signed)}
        payees={payees.data}
        eventNames={recentEventNames(events.data)}
        today={todayInLA()}
        deletableBy={request.status === "draft" && request.created_by === user.id ? user.id : null}
        detailHref={detailHref}
        afterDeleteHref="/admin"
      />
    </NarrowPage>
  );
}

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { NarrowPage } from "@/components/nav/app-shell";
import { EditRequestForm } from "@/components/requests/edit-request-form";
import { getCurrentPayeeId, getCurrentUser } from "@/lib/auth/current-user";
import { todayInLA } from "@/lib/dates";
import { signReceiptUrls } from "@/lib/receipts/signed-urls";
import { EDIT_REQUEST_COLUMNS, toEditableRequest } from "@/lib/requests/edit";
import { recentEventNames } from "@/lib/requests/event-names";
import { isEditableByRequester } from "@/lib/requests/format";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Edit request",
};

export default async function EditMyRequestPage({ params }: PageProps<"/my/[id]/edit">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const detailHref = `/my/${id}`;

  const supabase = await createClient();
  const [{ data: request, error }, payeeId, user] = await Promise.all([
    supabase
      .from("reimbursement_requests")
      .select(EDIT_REQUEST_COLUMNS)
      .eq("id", id)
      .order("position", { referencedTable: "lines" })
      .order("created_at", { referencedTable: "receipts" })
      .maybeSingle(),
    getCurrentPayeeId(),
    getCurrentUser(),
  ]);

  // Handled by my/error.tsx.
  if (error) throw error;
  if (!request || !payeeId || request.payee_id !== payeeId) notFound();
  // Once it's sent, only an owner changes it, until they ask for more info.
  if (!isEditableByRequester(request.status)) redirect(detailHref);

  const [events, signed] = await Promise.all([
    supabase
      .from("reimbursement_requests")
      .select("event_name")
      .eq("payee_id", payeeId)
      .not("event_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(200),
    signReceiptUrls(
      supabase,
      request.receipts.map((receipt) => receipt.storage_path),
    ),
  ]);
  if (events.error) throw events.error;

  return (
    <NarrowPage>
      <EditRequestForm
        request={toEditableRequest(id, request, "you", signed)}
        payees={null}
        eventNames={recentEventNames(events.data)}
        today={todayInLA()}
        deletableBy={request.status === "draft" && user && request.created_by === user.id ? user.id : null}
        detailHref={detailHref}
        afterDeleteHref="/my"
      />
    </NarrowPage>
  );
}

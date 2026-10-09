import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequestActions } from "@/components/requests/request-actions";
import { RequestDetail, TAGS_LABEL_ID } from "@/components/requests/request-detail";
import { RequestTagsEditor } from "@/components/tags/request-tags-editor";
import { TagList } from "@/components/tags/tag-list";
import { getCurrentUser } from "@/lib/auth/current-user";
import { todayInLA } from "@/lib/dates";
import { signReceiptUrls } from "@/lib/receipts/signed-urls";
import { lateSubmissionDays } from "@/lib/requests/actions";
import { isCorrectable, isEditable } from "@/lib/requests/format";
import { loadPayeeNames } from "@/lib/requests/queries";
import { changedPayeeIds, lateCheckDate } from "@/lib/requests/status";
import { createClient } from "@/lib/supabase/server";
import { REQUEST_TAGS_EMBED, sortTags, TAG_COLUMNS, tagsOf } from "@/lib/tags/tags";
import { isUuid } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Request",
};

const REQUEST_COLUMNS = `
  request_number, status, type, amount_cents, purchase_date, vendor, description,
  no_receipt, no_receipt_reason, external_approver, paid_at, payment_method, payment_reference, created_by,
  payee:payees(full_name, user_id),
  lines:request_lines(id, amount_cents, vendor),
  receipts(id, line_id, storage_path, original_filename, mime_type, width, height),
  request_events(id, action, from_status, note, changes, created_at, actor:users(full_name)),
  ${REQUEST_TAGS_EMBED}
` as const;

export default async function RequestPage({ params }: PageProps<"/admin/requests/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const [{ data: request, error }, { data: settings, error: settingsError }, user] = await Promise.all([
    supabase
      .from("reimbursement_requests")
      .select(REQUEST_COLUMNS)
      .eq("id", id)
      .order("position", { referencedTable: "lines" })
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

  const { request_events: events, tags: tagLinks, ...details } = request;
  const payeeIds = changedPayeeIds(events);
  const tags = tagsOf(tagLinks);
  // Viewers only look. The status functions and update policy check the role again.
  const isAdmin = user?.role === "admin";

  const [signed, payeeNames, allTags] = await Promise.all([
    signReceiptUrls(
      supabase,
      details.receipts.map((receipt) => receipt.storage_path),
    ),
    loadPayeeNames(supabase, payeeIds),
    // Only an owner changes tags, so only they need every one to pick from.
    isAdmin ? supabase.from("tags").select(TAG_COLUMNS) : null,
  ]);
  if (allTags?.error) throw allTags.error;

  const limitDays = settings.late_submission_days;
  const lateCheck = lateCheckDate(details.status, events, todayInLA());
  const lateDays = lateCheck && lateSubmissionDays(details.purchase_date, lateCheck.date, limitDays);

  const actions = isAdmin && (
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
        payeeFollows: details.payee?.user_id != null && details.payee.user_id !== user.id,
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
      tags={
        allTags ? (
          <RequestTagsEditor
            requestId={id}
            labelId={TAGS_LABEL_ID}
            tags={sortTags(allTags.data)}
            tagIds={tags.map((tag) => tag.id)}
          />
        ) : tags.length > 0 ? (
          <TagList tags={tags} />
        ) : (
          <span className="text-muted-foreground">None</span>
        )
      }
      editHref={
        isAdmin && (isEditable(details.status) || isCorrectable(details.status))
          ? `/admin/requests/${id}/edit`
          : undefined
      }
    />
  );
}

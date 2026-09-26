"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlertIcon } from "lucide-react";
import { ReceiptGallery, type GalleryReceipt } from "@/components/receipts/receipt-gallery";
import { usePendingReceipts } from "@/components/receipts/use-pending-receipts";
import { DeleteDraft } from "@/components/requests/delete-draft";
import {
  REQUEST_ERROR_FIELDS,
  RequestFields,
  requestFocusId,
  type RequestFormErrors,
} from "@/components/requests/request-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { todayInLA, type IsoDate } from "@/lib/dates";
import type { PayeeRow } from "@/lib/payees/columns";
import type { SignedReceiptUrls } from "@/lib/receipts/signed-urls";
import { MAX_RECEIPTS, removeReceipt, uploadReceipt } from "@/lib/receipts/upload";
import { editReceiptError } from "@/lib/requests/actions";
import { formatRequestNumber, type RequestStatus } from "@/lib/requests/format";
import {
  FUTURE_DATE_CODE,
  requestFieldErrors,
  requestSaveErrorMessage,
  requestSchema,
  type RequestFormValues,
} from "@/lib/requests/schema";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** A request opened for editing. */
export type EditableRequest = {
  id: string;
  requestNumber: number;
  status: RequestStatus;
  values: RequestFormValues;
  amountCents: number;
  payeeName: string;
  /** Oldest first. */
  receipts: GalleryReceipt[];
  /** Links for the receipts, signed while the page rendered. */
  signed: SignedReceiptUrls | null;
};

const CLOSED_MESSAGE = "It can't be edited anymore. It may have been approved or closed since this page loaded.";

function count(n: number, one: string, many: string): string {
  return n === 1 ? `1 receipt ${one}` : `${n} receipts ${many}`;
}

/**
 * Edits a request that's still open. Changes, removed receipts, and new ones
 * are all saved together, then it goes back to the request. The database
 * logs each change in the request's history.
 */
export function EditRequestForm({
  request,
  payees: initialPayees,
  eventNames,
  today,
  deletableBy,
}: {
  request: EditableRequest;
  /** Active payees plus the request's own, sorted by name. */
  payees: PayeeRow[];
  eventNames: string[];
  today: IsoDate;
  /** The signed-in admin, when they entered this draft and can delete it. */
  deletableBy: string | null;
}) {
  const router = useRouter();
  const detailHref = `/admin/requests/${request.id}`;
  const [payees, setPayees] = useState(initialPayees);
  const [values, setValues] = useState(request.values);
  const [errors, setErrors] = useState<RequestFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Saved receipts still on the request, and the ones marked to remove on save.
  const [saved, setSaved] = useState(request.receipts);
  const [marked, setMarked] = useState<ReadonlySet<string>>(() => new Set());

  const kept = saved.length - marked.size;
  const pendingReceipts = usePendingReceipts(MAX_RECEIPTS - kept, request.id);
  const { receipts } = pendingReceipts;
  const receiptCount = kept + receipts.length;
  const preparing = receipts.some((receipt) => receipt.status === "processing");

  function set<K extends keyof RequestFormValues>(key: K, value: RequestFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) =>
      key === "no_receipt"
        ? { ...current, receipts: undefined, no_receipt_reason: undefined }
        : { ...current, [key]: undefined },
    );
  }

  function toggleRemove(id: string) {
    setMarked((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
    setErrors((current) => ({ ...current, receipts: undefined }));
  }

  function addReceipts(files: File[]) {
    setErrors((current) => ({ ...current, receipts: undefined }));
    pendingReceipts.add(files);
  }

  function showFieldErrors(next: RequestFormErrors) {
    setErrors(next);
    const first = REQUEST_ERROR_FIELDS.find((key) => next[key]);
    if (first) document.getElementById(requestFocusId(first))?.focus();
  }

  async function save() {
    if (preparing) return;
    const parsed = requestSchema(todayInLA()).safeParse(values);
    const next: RequestFormErrors = parsed.success ? {} : requestFieldErrors(parsed.error);
    const receiptError = editReceiptError(request.status, { receiptCount, noReceipt: values.no_receipt });
    if (receiptError) next.receipts = receiptError;
    if (!parsed.success || receiptError) {
      showFieldErrors(next);
      return;
    }

    setErrors({});
    setFormError(null);
    setPending(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("reimbursement_requests")
      .update(parsed.data)
      .eq("id", request.id)
      .select("id")
      .single();
    if (error) {
      setPending(false);
      // No row back means the update policy turned it down: it's no longer open.
      if (error.code === "PGRST116") setFormError(CLOSED_MESSAGE);
      else if (error.code === FUTURE_DATE_CODE) showFieldErrors({ purchase_date: requestSaveErrorMessage(error) });
      else setFormError(requestSaveErrorMessage(error));
      return;
    }

    // Removed before adding, so a full request has room for the new ones.
    let notRemoved = 0;
    for (const receipt of saved.filter((candidate) => marked.has(candidate.id))) {
      try {
        await removeReceipt(supabase, { id: receipt.id, path: receipt.path });
        setSaved((current) => current.filter((candidate) => candidate.id !== receipt.id));
        setMarked((current) => {
          const next = new Set(current);
          next.delete(receipt.id);
          return next;
        });
      } catch {
        notRemoved++;
      }
    }

    // One at a time, to go easy on a phone's connection.
    let notUploaded = 0;
    for (const receipt of receipts) {
      if (!receipt.prepared || (receipt.status !== "ready" && receipt.status !== "failed")) continue;
      pendingReceipts.setStatus(receipt.key, "uploading");
      try {
        await uploadReceipt(supabase, request.id, receipt.prepared);
        pendingReceipts.setStatus(receipt.key, "uploaded");
      } catch {
        pendingReceipts.setStatus(receipt.key, "failed");
        notUploaded++;
      }
    }

    if (notRemoved > 0 || notUploaded > 0) {
      setPending(false);
      const problems = [
        notRemoved > 0 && count(notRemoved, "wasn't removed", "weren't removed"),
        notUploaded > 0 && count(notUploaded, "didn't upload", "didn't upload"),
      ].filter(Boolean);
      setFormError(`The changes are saved, but ${problems.join(" and ")}. Save again to retry.`);
      return;
    }

    // Replaces this page, so going back can't reopen the form with the old values.
    router.replace(detailHref);
  }

  const busy = pending || preparing;

  return (
    <div className="space-y-5">
      <form
        noValidate
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">Edit {formatRequestNumber(request.requestNumber)}</h1>

        <RequestFields
          values={values}
          errors={errors}
          onChange={set}
          payees={payees}
          onPayeeAdded={(added) =>
            setPayees((current) => [...current, added].sort((a, b) => a.full_name.localeCompare(b.full_name)))
          }
          eventNames={eventNames}
          today={today}
          pendingReceipts={pendingReceipts}
          savedReceipts={
            saved.length > 0 && (
              <ReceiptGallery
                receipts={saved}
                initial={request.signed}
                label="Saved receipts"
                removal={{
                  marked,
                  onToggle: toggleRemove,
                  // A receipt can't come back while "No receipt on file" is on.
                  canKeep: receiptCount < MAX_RECEIPTS && !values.no_receipt,
                  locked: pending,
                }}
              />
            )
          }
          receiptCount={receiptCount}
          onAddReceipts={addReceipts}
          locked={pending}
        />

        {formError && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {pending ? "Saving…" : preparing ? "Preparing receipts…" : "Save changes"}
          </Button>
          <Button
            variant="outline"
            className={cn("h-11 w-full", pending && "pointer-events-none opacity-50")}
            aria-disabled={pending || undefined}
            asChild
          >
            <Link href={detailHref} replace>
              Cancel
            </Link>
          </Button>
        </div>
      </form>

      {/* Outside the form: the sheet's events would bubble up to it through the portal. */}
      {deletableBy && (
        <div className="border-t pt-5">
          <DeleteDraft
            request={{
              id: request.id,
              requestNumber: request.requestNumber,
              amountCents: request.amountCents,
              payeeName: request.payeeName,
            }}
            userId={deletableBy}
            disabled={pending}
          />
        </div>
      )}
    </div>
  );
}

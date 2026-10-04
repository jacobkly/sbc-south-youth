"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlertIcon, InfoIcon } from "lucide-react";
import { ReceiptGallery, type GalleryReceipt } from "@/components/receipts/receipt-gallery";
import { usePendingReceipts } from "@/components/receipts/use-pending-receipts";
import { CorrectionSheet, type PendingCorrection } from "@/components/requests/correction-sheet";
import { DeleteDraft } from "@/components/requests/delete-draft";
import { paymentFieldId, PaymentFields } from "@/components/requests/payment-fields";
import { requestErrorIds, RequestFields, type RequestFormErrors } from "@/components/requests/request-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { laDateOf, todayInLA, type IsoDate } from "@/lib/dates";
import type { PayeeRow } from "@/lib/payees/columns";
import type { SignedReceiptUrls } from "@/lib/receipts/signed-urls";
import { MAX_RECEIPTS, removeReceipt, uploadReceipt } from "@/lib/receipts/upload";
import { editReceiptError, requesterReceiptError, validatePayment, type PaymentValues } from "@/lib/requests/actions";
import {
  correctedPaidAt,
  correctionChanges,
  correctionSnapshot,
  correctRequestArgs,
  filesSummary,
  type CorrectedPayment,
  type CorrectionSnapshot,
} from "@/lib/requests/corrections";
import { formatRequestNumber, type RequestStatus } from "@/lib/requests/format";
import {
  errorsAfterChange,
  isFutureDateError,
  requestFieldErrors,
  requestSaveErrorMessage,
  requestSchema,
  saveRequestArgs,
  type RequestFormValues,
  type RequestInput,
} from "@/lib/requests/schema";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** A saved file, and the receipt it belongs to. */
export type SavedFile = GalleryReceipt & { lineId: string };

/** A request opened for editing. */
export type EditableRequest = {
  id: string;
  requestNumber: number;
  status: RequestStatus;
  values: RequestFormValues;
  amountCents: number;
  payeeName: string;
  /** Oldest first. */
  receipts: SavedFile[];
  /** Links for the receipts, signed while the page rendered. */
  signed: SignedReceiptUrls | null;
  /** An approved or paid request as it's saved, which an owner's edits correct. Null while it's open. */
  correction: CorrectionSnapshot | null;
};

const CLOSED_MESSAGE = "You can't edit it anymore. Someone may have approved or closed it since this page loaded.";

const CLOSED_ERRORS = new Set([
  "This request can't be edited anymore.",
  "Only a draft or a request that needs info can be edited.",
]);

/** The database turned the save down because the request isn't open anymore. */
function isClosedError(error: { code?: string; message?: string }): boolean {
  return error.code === "55000" && CLOSED_ERRORS.has(error.message ?? "");
}

const UNCORRECTABLE_MESSAGE =
  "It can't be corrected anymore. Someone may have undone its approval or payment since this page loaded.";

/** The database turned a correction down because the request isn't approved or paid anymore. */
function isUncorrectableError(error: { code?: string; message?: string }): boolean {
  return error.code === "55000" && error.message === "Only an approved or paid request can be corrected.";
}

const PAYMENT_PREFIX = "correction";
const PAYMENT_ERROR_FIELDS = ["paid_date", "payment_reference"] as const;
type PaymentErrors = Partial<Record<(typeof PAYMENT_ERROR_FIELDS)[number], string>>;

/** The form's values, checked and ready to save. */
type Checked = { input: RequestInput; payment: CorrectedPayment | null };

function count(n: number, one: string, many: string): string {
  return n === 1 ? `1 file ${one}` : `${n} files ${many}`;
}

/**
 * Edits a request that's still open. Changes, removed files, and new ones
 * are all saved together, then it goes back to the request. The database
 * logs each change in the request's history.
 *
 * A requester edits their own: there's no payee to pick or no-receipt
 * exception to turn on, and anything past a draft needs a receipt photo.
 *
 * An owner can still fix an approved or paid request, including its payment
 * once it's paid. That's a correction: they confirm what changes and say what
 * was wrong, and its status stays. Who it's paid to can't change.
 */
export function EditRequestForm({
  request,
  payees: initialPayees = null,
  eventNames,
  today,
  deletableBy,
  detailHref,
  afterDeleteHref,
}: {
  request: EditableRequest;
  /** Active payees plus the request's own, sorted by name. Null for a requester, who can't change who's paid. */
  payees?: PayeeRow[] | null;
  eventNames: string[];
  today: IsoDate;
  /** The signed-in person, when they entered this draft and can delete it. */
  deletableBy: string | null;
  /** The request's page, where saving and Go back return to. */
  detailHref: string;
  /** Where to go once the draft is deleted. */
  afterDeleteHref: string;
}) {
  const router = useRouter();
  const requester = initialPayees === null;
  const correcting = !requester && request.correction !== null;
  const paid = correcting && request.status === "paid";
  const [payees, setPayees] = useState(initialPayees ?? []);
  const [values, setValues] = useState(request.values);
  const [errors, setErrors] = useState<RequestFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Saved files still on the request, and the ones marked to remove on save.
  const [saved, setSaved] = useState(request.receipts);
  const [marked, setMarked] = useState<ReadonlySet<string>>(() => new Set());
  // A correction compares with the request as it's saved, which moves on once one is saved.
  const [baseline, setBaseline] = useState(correcting ? request.correction : null);
  const [payment, setPayment] = useState<PaymentValues>(() => ({
    payment_method: request.correction?.payment_method ?? "cash_app",
    payment_reference: request.correction?.payment_reference ?? "",
    paid_date: request.correction?.paid_at ? laDateOf(request.correction.paid_at) : today,
  }));
  const [paymentErrors, setPaymentErrors] = useState<PaymentErrors>({});
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState<PendingCorrection | null>(null);
  // Once a correction is saved, retrying files that didn't upload doesn't record it again.
  const [recorded, setRecorded] = useState(false);

  // Taking off a receipt takes its saved files with it.
  const lineIds = new Set(values.lines.map((line) => line.id));
  const removing = saved.filter((file) => marked.has(file.id) || !lineIds.has(file.lineId));
  const kept = saved.length - removing.length;
  const pendingReceipts = usePendingReceipts(MAX_RECEIPTS - kept, request.id);
  const { receipts } = pendingReceipts;
  const receiptCount = kept + receipts.length;
  const preparing = receipts.some((receipt) => receipt.status === "processing");
  const toUpload = receipts.filter(
    (receipt) => receipt.prepared && (receipt.status === "ready" || receipt.status === "failed"),
  );

  function set<K extends keyof RequestFormValues>(key: K, value: RequestFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => errorsAfterChange(current, key, values[key], value));
  }

  function setPaymentValue<K extends keyof PaymentValues>(key: K, value: PaymentValues[K]) {
    setPayment((current) => ({ ...current, [key]: value }));
    if (key in paymentErrors) setPaymentErrors((current) => ({ ...current, [key]: undefined }));
  }

  function toggleRemove(id: string) {
    setMarked((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
    setErrors((current) => ({ ...current, receipts: undefined }));
  }

  function addReceipts(files: File[], lineId: string) {
    setErrors((current) => ({ ...current, receipts: undefined }));
    pendingReceipts.add(files, lineId);
  }

  function showFieldErrors(next: RequestFormErrors, nextPayment: PaymentErrors = {}) {
    setErrors(next);
    setPaymentErrors(nextPayment);
    const paymentIds = PAYMENT_ERROR_FIELDS.filter((field) => nextPayment[field]).map((field) =>
      paymentFieldId(PAYMENT_PREFIX, field),
    );
    const [first] = [...requestErrorIds(next, values.lines), ...paymentIds];
    if (first) document.getElementById(first)?.focus();
  }

  /** Checks the form and shows what's wrong. Null when something is. */
  function check(): Checked | null {
    const now = todayInLA();
    const parsed = requestSchema(now).safeParse(values);
    const next: RequestFormErrors = parsed.success ? {} : requestFieldErrors(parsed.error, values.lines);
    const receiptContext = { receiptCount, noReceipt: values.no_receipt };
    const receiptError = requester
      ? requesterReceiptError(request.status !== "draft", receiptContext)
      : editReceiptError(request.status, receiptContext);
    if (receiptError) next.receipts = receiptError;
    const checkedPayment = paid ? validatePayment(payment, { today: now, purchaseDate: values.purchase_date }) : null;
    if (!parsed.success || receiptError || checkedPayment?.success === false) {
      showFieldErrors(next, checkedPayment?.success === false ? checkedPayment.errors : {});
      return null;
    }

    setErrors({});
    setPaymentErrors({});
    const paidAt = baseline?.paid_at;
    return {
      input: parsed.data,
      payment:
        checkedPayment && paidAt
          ? {
              paid_at: correctedPaidAt(paidAt, checkedPayment.data.paid_date),
              payment_method: checkedPayment.data.payment_method,
              payment_reference: checkedPayment.data.payment_reference,
            }
          : null,
    };
  }

  function save() {
    if (preparing) return;
    const checked = check();
    if (!checked) return;
    setFormError(null);
    if (!baseline) {
      void commit(checked, "save");
      return;
    }

    const changes = correctionChanges(baseline, correctionSnapshot(checked.input, checked.payment));
    if (!changes && removing.length === 0 && (recorded || toUpload.length === 0)) {
      // Nothing to correct. Retry the files that didn't upload, if any.
      if (toUpload.length > 0) void commit(checked, "files");
      else router.replace(detailHref);
      return;
    }
    setConfirming({ changes, files: filesSummary(toUpload.length, removing.length) });
  }

  function confirmCorrection() {
    setConfirming(null);
    const checked = check();
    if (checked) void commit(checked, "correct");
  }

  /**
   * Removes files, saves the fields, then uploads new files. A correction
   * saves the fields with its reason, and a retry after one only has files left.
   */
  async function commit({ input, payment: correctedPayment }: Checked, step: "save" | "correct" | "files") {
    setPending(true);
    const supabase = createClient();

    // Files go first: a receipt can't be taken off while it has any, and a full request needs the room.
    let notRemoved = 0;
    for (const file of removing) {
      try {
        await removeReceipt(supabase, { id: file.id, path: file.path });
        setSaved((current) => current.filter((candidate) => candidate.id !== file.id));
        setMarked((current) => {
          const rest = new Set(current);
          rest.delete(file.id);
          return rest;
        });
      } catch {
        notRemoved++;
      }
    }
    if (notRemoved > 0) {
      setPending(false);
      setFormError(`${count(notRemoved, "wasn't removed", "weren't removed")}, so the changes weren't saved. Save again to retry.`);
      return;
    }

    if (step !== "files") {
      const { error } = await (step === "correct"
        ? supabase.rpc("correct_request", correctRequestArgs(request.id, input, correctedPayment, reason.trim()))
        : supabase.rpc("save_request", saveRequestArgs(request.id, input)));
      if (error) {
        setPending(false);
        if (isClosedError(error)) setFormError(CLOSED_MESSAGE);
        else if (isUncorrectableError(error)) setFormError(UNCORRECTABLE_MESSAGE);
        else if (isFutureDateError(error)) showFieldErrors({ purchase_date: requestSaveErrorMessage(error) });
        else setFormError(requestSaveErrorMessage(error));
        return;
      }
      if (step === "correct") {
        setBaseline(correctionSnapshot(input, correctedPayment));
        setRecorded(true);
        setReason("");
      }
    }

    // One at a time, to go easy on a phone's connection.
    let notUploaded = 0;
    for (const receipt of toUpload) {
      if (!receipt.prepared) continue;
      pendingReceipts.setStatus(receipt.key, "uploading");
      try {
        await uploadReceipt(supabase, request.id, receipt.line, receipt.prepared);
        pendingReceipts.setStatus(receipt.key, "uploaded");
      } catch {
        pendingReceipts.setStatus(receipt.key, "failed");
        notUploaded++;
      }
    }

    if (notUploaded > 0) {
      setPending(false);
      setFormError(`The changes are saved, but ${count(notUploaded, "didn't upload", "didn't upload")}. Save again to retry.`);
      return;
    }

    // Replaces this page, so going back can't reopen the form with the old values.
    router.replace(detailHref);
  }

  const busy = pending || preparing;

  function savedFiles(lineId: string, title?: string) {
    const files = saved.filter((file) => file.lineId === lineId);
    if (files.length === 0) return null;
    return (
      <ReceiptGallery
        receipts={files}
        title={title}
        initial={request.signed}
        label="Saved receipts"
        removal={{
          marked,
          onToggle: toggleRemove,
          // A file can't come back while "No receipt on file" is on, which a requester can't change.
          canKeep: receiptCount < MAX_RECEIPTS && (requester || !values.no_receipt),
          locked: pending,
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <form
        noValidate
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">
          {correcting ? "Correct" : "Edit"} {formatRequestNumber(request.requestNumber)}
        </h1>

        {correcting && (
          <>
            <Alert role="note">
              <InfoIcon />
              <AlertDescription>
                This request is {paid ? "paid" : "approved"}. Your changes are saved as a correction and show in its
                history.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <p className="text-sm leading-none font-medium">Payee</p>
              <p className="text-base break-words">{request.payeeName}</p>
              <p className="text-xs text-muted-foreground">
                To change who it&apos;s paid to, undo the {paid ? "payment and approval" : "approval"} first.
              </p>
            </div>
          </>
        )}

        <RequestFields
          values={values}
          errors={errors}
          onChange={set}
          payeePicker={
            requester || correcting
              ? undefined
              : {
                  payees,
                  onAdded: (added) =>
                    setPayees((current) => [...current, added].sort((a, b) => a.full_name.localeCompare(b.full_name))),
                }
          }
          allowNoReceipt={!requester}
          eventNames={eventNames}
          today={today}
          pendingReceipts={pendingReceipts}
          savedReceipts={savedFiles}
          receiptCount={receiptCount}
          onAddReceipts={addReceipts}
          locked={pending}
        />

        {paid && (
          <PaymentFields
            idPrefix={PAYMENT_PREFIX}
            values={payment}
            onChange={setPaymentValue}
            errors={paymentErrors}
            purchaseDate={values.purchase_date}
            today={today}
            disabled={pending}
          />
        )}

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
              Go back
            </Link>
          </Button>
        </div>
      </form>

      {/* Outside the form: the sheet's events would bubble up to it through the portal. */}
      {correcting && (
        <CorrectionSheet
          opened={confirming}
          requestNumber={request.requestNumber}
          paid={paid}
          reason={reason}
          onReasonChange={setReason}
          onConfirm={confirmCorrection}
          onClose={() => setConfirming(null)}
        />
      )}

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
            afterDeleteHref={afterDeleteHref}
            disabled={pending}
          />
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { usePendingReceipts } from "@/components/receipts/use-pending-receipts";
import {
  blankRequest,
  requestErrorIds,
  RequestFields,
  type RequestFormErrors,
} from "@/components/requests/request-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { todayInLA, type IsoDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { uploadReceipt } from "@/lib/receipts/upload";
import { applySaveAction, requesterReceiptError, saveActionErrorMessage } from "@/lib/requests/actions";
import { formatRequestNumber } from "@/lib/requests/format";
import {
  errorsAfterChange,
  isFutureDateError,
  requestFieldErrors,
  requestSaveErrorMessage,
  requestSchema,
  saveRequestArgs,
  type RequestFormValues,
} from "@/lib/requests/schema";
import { createClient } from "@/lib/supabase/client";

type Intent = "submit" | "draft";

type Saved = { id: string; requestNumber: number; intent: Intent; amountCents: number };

/**
 * A requester's form for their own reimbursement. It's always paid to them,
 * so there's no payee to pick, and sending it needs a photo of the receipt.
 * They can also save a draft to finish later, like before the receipt is
 * handy.
 */
export function MyRequestForm({
  payeeId,
  eventNames,
  today,
}: {
  /** The payee the signed-in person is linked to. */
  payeeId: string;
  /** Recent event names from their own requests, offered as suggestions. */
  eventNames: string[];
  /** Today in Los Angeles, from the server so the first render matches. */
  today: IsoDate;
}) {
  const blank = (date: IsoDate) => ({ ...blankRequest(date), payee_id: payeeId });
  const [values, setValues] = useState<RequestFormValues>(() => blank(today));
  const [errors, setErrors] = useState<RequestFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<Intent | null>(null);
  // Set once the draft exists, so a retry after a failed step updates it instead of adding another.
  const [requestId, setRequestId] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const pendingReceipts = usePendingReceipts();
  const { receipts } = pendingReceipts;
  const preparing = receipts.some((receipt) => receipt.status === "processing");

  // Moves focus to the top of the new screen after saving or starting over.
  const heading = useRef<HTMLHeadingElement>(null);
  const [screen, setScreen] = useState(0);
  useEffect(() => {
    if (screen === 0) return;
    window.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [screen]);

  function set<K extends keyof RequestFormValues>(key: K, value: RequestFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => errorsAfterChange(current, key, values[key], value));
  }

  function showFieldErrors(next: RequestFormErrors) {
    setErrors(next);
    const [first] = requestErrorIds(next, values.lines);
    if (first) document.getElementById(first)?.focus();
  }

  async function save(intent: Intent) {
    if (pending || preparing) return;
    // Checked against today at save time, in case the page sat open past midnight.
    const parsed = requestSchema(todayInLA()).safeParse(values);
    const next: RequestFormErrors = parsed.success ? {} : requestFieldErrors(parsed.error, values.lines);
    const receiptError = requesterReceiptError(intent === "submit", {
      receiptCount: receipts.length,
      noReceipt: values.no_receipt,
    });
    if (receiptError) next.receipts = receiptError;
    if (!parsed.success || receiptError) {
      showFieldErrors(next);
      return;
    }

    setErrors({});
    setFormError(null);
    setPending(intent);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("save_request", saveRequestArgs(requestId, parsed.data));

    if (error) {
      setPending(null);
      const message = requestSaveErrorMessage(error);
      if (isFutureDateError(error)) showFieldErrors({ purchase_date: message });
      else setFormError(message);
      return;
    }
    setRequestId(data.id);

    // One at a time, to go easy on a phone's connection.
    let failed = 0;
    for (const receipt of receipts) {
      if (!receipt.prepared || (receipt.status !== "ready" && receipt.status !== "failed")) continue;
      pendingReceipts.setStatus(receipt.key, "uploading");
      try {
        await uploadReceipt(supabase, data.id, receipt.line, receipt.prepared);
        pendingReceipts.setStatus(receipt.key, "uploaded");
      } catch {
        pendingReceipts.setStatus(receipt.key, "failed");
        failed++;
      }
    }

    if (failed > 0) {
      setPending(null);
      setFormError(
        failed === 1
          ? "The draft is saved, but 1 file didn't upload. Try again, or remove it."
          : `The draft is saved, but ${failed} files didn't upload. Try again, or remove them.`,
      );
      return;
    }

    const actionError = await applySaveAction(supabase, data.id, { option: intent });
    setPending(null);
    if (actionError && intent === "submit") {
      setFormError(saveActionErrorMessage("submit", actionError));
      return;
    }

    setSaved({ id: data.id, requestNumber: data.request_number, intent, amountCents: parsed.data.amount_cents });
    setScreen((count) => count + 1);
  }

  function startAnother() {
    setValues(blank(todayInLA()));
    setErrors({});
    setFormError(null);
    setRequestId(null);
    pendingReceipts.clear();
    setSaved(null);
    setScreen((count) => count + 1);
  }

  function addReceipts(files: File[], lineId: string) {
    setErrors((current) => ({ ...current, receipts: undefined }));
    pendingReceipts.add(files, lineId);
  }

  if (saved) return <SavedPanel saved={saved} heading={heading} onStartAnother={startAnother} />;

  const busy = pending !== null || preparing;

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save("submit");
      }}
    >
      <div className="space-y-1">
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
          New request
        </h1>
        <p className="text-sm text-muted-foreground">Paid for something yourself? Get it paid back.</p>
      </div>

      <RequestFields
        values={values}
        errors={errors}
        onChange={set}
        allowNoReceipt={false}
        eventNames={eventNames}
        today={today}
        pendingReceipts={pendingReceipts}
        receiptCount={receipts.length}
        onAddReceipts={addReceipts}
        locked={pending !== null}
      />

      {/* Next to the buttons, since that's where the eye is after tapping one on a phone. */}
      {formError && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <Button type="submit" className="h-11 w-full" disabled={busy}>
          {pending === "submit" ? "Submitting…" : preparing ? "Preparing receipts…" : "Submit"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          disabled={busy}
          onClick={() => void save("draft")}
        >
          {pending === "draft" ? "Saving…" : "Save draft"}
        </Button>
      </div>
    </form>
  );
}

function SavedPanel({
  saved,
  heading,
  onStartAnother,
}: {
  saved: Saved;
  heading: RefObject<HTMLHeadingElement | null>;
  onStartAnother: () => void;
}) {
  const submitted = saved.intent === "submit";
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <CircleCheckIcon className="size-8 text-primary" aria-hidden />
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
          {submitted ? "Submitted" : "Draft saved"}
        </h1>
        <p className="text-muted-foreground">
          {formatRequestNumber(saved.requestNumber)} ·{" "}
          <span className="tabular-nums">{formatCents(saved.amountCents)}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {submitted
            ? "It's waiting for review. Check My requests to see where it stands."
            : "It isn't sent yet. Submit it from My requests when it's ready."}
        </p>
      </div>

      <div className="space-y-3">
        <Button className="h-11 w-full" asChild>
          {/* Replaces the form, so going back from the request skips it. */}
          <Link href={`/my/${saved.id}`} replace>
            View request
          </Link>
        </Button>
        <Button type="button" variant="outline" className="h-11 w-full" onClick={onStartAnother}>
          New request
        </Button>
      </div>
    </div>
  );
}

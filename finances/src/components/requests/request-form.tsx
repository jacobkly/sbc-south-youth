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
import { saveFieldId, SaveOptions } from "@/components/requests/save-options";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { todayInLA, type IsoDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import type { PayeeRow } from "@/lib/payees/columns";
import { uploadReceipt } from "@/lib/receipts/upload";
import {
  applySaveAction,
  availableSaveOptions,
  lateSubmissionDays,
  needsExternalApprover,
  SAVE_OPTION_LABELS,
  saveActionErrorMessage,
  validateSaveOption,
  type SaveOption,
  type SaveOptionErrors,
  type SaveOptionField,
  type SaveOptionValues,
} from "@/lib/requests/actions";
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

type FormErrors = RequestFormErrors & SaveOptionErrors;

/** The save option's fields that can show an error, in the order they appear on screen. */
const SAVE_ERROR_FIELDS = ["paid_date", "payment_reference", "external_approver"] as const;

type Saved = {
  id: string;
  requestNumber: number;
  option: SaveOption;
  amountCents: number;
  payeeName: string;
};

/**
 * The admin's main entry form. Built for speed on a phone: big touch targets,
 * the right keyboard for each field, and today's date filled in. After saving,
 * "Enter another" starts over but keeps how it was saved and paid, so a run
 * of past payments goes quickly.
 */
export function RequestForm({
  payees: initialPayees,
  eventNames,
  today,
  currentUserId,
  allowExternalApproval,
  lateLimitDays,
}: {
  /** Active payees, sorted by name. */
  payees: PayeeRow[];
  /** Recent event names, offered as suggestions. */
  eventNames: string[];
  /** Today in Los Angeles, from the server so the first render matches. */
  today: IsoDate;
  /** The signed-in admin, to spot a reimbursement paid to them. */
  currentUserId: string;
  allowExternalApproval: boolean;
  /** Days after purchase before a request counts as late. */
  lateLimitDays: number;
}) {
  const [payees, setPayees] = useState(initialPayees);
  const [values, setValues] = useState<RequestFormValues>(() => blankRequest(today));
  const [saveValues, setSaveValues] = useState<SaveOptionValues>({
    option: "draft",
    external_approver: "",
    payment_method: "cash_app",
    payment_reference: "",
    paid_date: today,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
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

  const payee = payees.find((candidate) => candidate.id === values.payee_id);
  const rules = { selfPayee: Boolean(payee?.user_id && payee.user_id === currentUserId), allowExternalApproval };
  const options = availableSaveOptions(rules);
  // Switching to your own payee can take away the option that was picked.
  const option = options.includes(saveValues.option) ? saveValues.option : "draft";
  const lateDays = lateSubmissionDays(values.purchase_date, today, lateLimitDays);

  function set<K extends keyof RequestFormValues>(key: K, value: RequestFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => errorsAfterChange(current, key, values[key], value));
  }

  function setSave<K extends keyof SaveOptionValues>(key: K, value: SaveOptionValues[K]) {
    setSaveValues((current) => ({ ...current, [key]: value }));
    if (key === "option") {
      // These errors depend on the option, so they may not apply anymore.
      setErrors((current) => ({
        ...current,
        receipts: undefined,
        paid_date: undefined,
        payment_reference: undefined,
        external_approver: undefined,
      }));
    } else {
      setErrors((current) => ({ ...current, [key as SaveOptionField]: undefined }));
    }
  }

  function showFieldErrors(next: FormErrors) {
    setErrors(next);
    const [first] = [
      ...requestErrorIds(next, values.lines),
      ...SAVE_ERROR_FIELDS.filter((key) => next[key]).map(saveFieldId),
    ];
    if (first) document.getElementById(first)?.focus();
  }

  async function save() {
    if (preparing) return;
    // Checked against today at save time, in case the page sat open past midnight.
    const now = todayInLA();
    const parsed = requestSchema(now).safeParse(values);
    const action = validateSaveOption(
      { ...saveValues, option },
      {
        ...rules,
        today: now,
        purchaseDate: values.purchase_date,
        receiptCount: receipts.length,
        noReceipt: values.no_receipt,
      },
    );
    if (!parsed.success || !action.success) {
      showFieldErrors({
        ...(parsed.success ? {} : requestFieldErrors(parsed.error, values.lines)),
        ...(action.success ? {} : action.errors),
      });
      return;
    }

    setErrors({});
    setFormError(null);
    setPending(true);
    const supabase = createClient();
    // Creates the draft, or updates it on a retry. The receipts' ids come from here, so a retry updates them too.
    const { data, error } = await supabase.rpc("save_request", saveRequestArgs(requestId, parsed.data));

    if (error) {
      setPending(false);
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
      setPending(false);
      setFormError(
        failed === 1
          ? "The draft is saved, but 1 file didn't upload. Save again to retry, or remove it."
          : `The draft is saved, but ${failed} files didn't upload. Save again to retry, or remove them.`,
      );
      return;
    }

    const actionError = await applySaveAction(supabase, data.id, action.data);
    setPending(false);
    if (actionError && action.data.option !== "draft") {
      setFormError(saveActionErrorMessage(action.data.option, actionError));
      return;
    }

    setSaved({
      id: data.id,
      requestNumber: data.request_number,
      option,
      amountCents: parsed.data.amount_cents,
      payeeName: payee?.full_name ?? "",
    });
    setScreen((count) => count + 1);
  }

  /** Clears the form for the next request, keeping how it's saved and the payment method and date. */
  function enterAnother() {
    setValues(blankRequest(todayInLA()));
    setSaveValues((current) => ({ ...current, external_approver: "", payment_reference: "" }));
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

  if (saved) return <SavedPanel saved={saved} heading={heading} onEnterAnother={enterAnother} />;

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
        New request
      </h1>

      <RequestFields
        values={values}
        errors={errors}
        onChange={set}
        payeePicker={{
          payees,
          onAdded: (added) =>
            setPayees((current) => [...current, added].sort((a, b) => a.full_name.localeCompare(b.full_name))),
        }}
        eventNames={eventNames}
        today={today}
        pendingReceipts={pendingReceipts}
        receiptCount={receipts.length}
        onAddReceipts={addReceipts}
        locked={pending}
      />

      <SaveOptions
        values={{ ...saveValues, option }}
        onChange={setSave}
        errors={errors}
        options={options}
        approverRequired={needsExternalApprover(option, rules)}
        selfApprovalBlocked={rules.selfPayee && !allowExternalApproval}
        lateDays={lateDays}
        lateLimitDays={lateLimitDays}
        purchaseDate={values.purchase_date}
        today={today}
        disabled={pending}
      />

      {/* Next to the button, since that's where the eye is after tapping it on a phone. */}
      {formError && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="h-11 w-full" disabled={pending || preparing}>
        {pending ? "Saving…" : preparing ? "Preparing receipts…" : SAVE_OPTION_LABELS[option]}
      </Button>
    </form>
  );
}

const SAVED_HEADINGS: Record<SaveOption, string> = {
  draft: "Draft saved",
  submit: "Submitted",
  approve: "Approved",
  paid: "Recorded as paid",
};

function SavedPanel({
  saved,
  heading,
  onEnterAnother,
}: {
  saved: Saved;
  heading: RefObject<HTMLHeadingElement | null>;
  onEnterAnother: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <CircleCheckIcon className="size-8 text-primary" aria-hidden />
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
          {SAVED_HEADINGS[saved.option]}
        </h1>
        <p className="text-muted-foreground">
          {formatRequestNumber(saved.requestNumber)} · <span className="tabular-nums">{formatCents(saved.amountCents)}</span>{" "}
          to {saved.payeeName}
        </p>
      </div>

      <div className="space-y-3">
        <Button type="button" className="h-11 w-full" onClick={onEnterAnother}>
          Enter another
        </Button>
        <Button variant="outline" className="h-11 w-full" asChild>
          {/* Replaces the form, so going back from the request skips it. */}
          <Link href={`/admin/requests/${saved.id}`} replace>
            View request
          </Link>
        </Button>
      </div>
    </div>
  );
}

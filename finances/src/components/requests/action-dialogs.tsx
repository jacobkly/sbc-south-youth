"use client";

import { useState } from "react";
import { CircleAlertIcon, InfoIcon } from "lucide-react";
import { describedBy, FormField } from "@/components/form-field";
import { ApproverField, paymentFieldId, PaymentFields } from "@/components/requests/payment-fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ResponsiveSheetContent } from "@/components/ui/responsive-sheet";
import { Sheet, SheetClose, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { IsoDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import {
  appErrorMessage,
  applyRequestAction,
  blockedByReceiptRule,
  isNoteAction,
  isWrongStatusError,
  MAX_NOTE,
  needsExternalApprover,
  recordsPayment,
  RETRY_MESSAGE,
  validateRequestAction,
  type RequestAction,
  type RequestActionErrors,
  type RequestActionField,
  type RequestActionValues,
  type SaveContext,
} from "@/lib/requests/actions";
import { formatRequestNumber, type RequestStatus } from "@/lib/requests/format";
import { createClient } from "@/lib/supabase/client";

/** What the action sheet needs to know about the request. */
export type ActionRequest = {
  id: string;
  requestNumber: number;
  status: RequestStatus;
  amountCents: number;
  payeeName: string;
  purchaseDate: string;
  receiptCount: number;
  noReceipt: boolean;
};

/** An action being confirmed. `key` changes each time one opens, so its fields start blank. */
export type OpenedAction = { action: RequestAction; today: IsoDate; key: number };

type ActionCopy = {
  /** The button that opens the sheet, and the one that confirms it. */
  label: string;
  title: string;
  description: string;
  /** Titles the error when it fails. */
  failed: string;
  /** Announced once it's done. */
  done: string;
  /** Final, or takes something away. */
  destructive?: boolean;
};

const COPY: Record<RequestAction, ActionCopy> = {
  submit: {
    label: "Submit",
    title: "Submit it for review?",
    description: "It's marked ready for review.",
    failed: "Couldn't submit it",
    done: "Submitted.",
  },
  approve: {
    label: "Approve",
    title: "Approve it?",
    description: "It's approved and ready to pay.",
    failed: "Couldn't approve it",
    done: "Approved.",
  },
  record_paid: {
    label: "Record as paid",
    title: "Record as paid",
    description: "Approves it and records the payment in one step.",
    failed: "Couldn't record the payment",
    done: "Recorded as paid.",
  },
  request_info: {
    label: "Request info",
    title: "Ask for more info",
    description: "It's on hold until you have what's missing. Resubmit it then.",
    failed: "Couldn't ask for more info",
    done: "Marked as needing more info.",
  },
  reject: {
    label: "Reject",
    title: "Reject it?",
    description: "It's closed for good. This can't be undone.",
    failed: "Couldn't reject it",
    done: "Rejected.",
    destructive: true,
  },
  cancel: {
    label: "Cancel request",
    title: "Cancel it?",
    description: "It's withdrawn for good. This can't be undone.",
    failed: "Couldn't cancel it",
    done: "Cancelled.",
    destructive: true,
  },
  unapprove: {
    label: "Undo approval",
    title: "Undo the approval?",
    description: "It goes back to submitted.",
    failed: "Couldn't undo the approval",
    done: "Approval undone.",
  },
  mark_paid: {
    label: "Mark paid",
    title: "Mark as paid",
    description: "Records how and when it was paid.",
    failed: "Couldn't mark it paid",
    done: "Marked paid.",
  },
  unmark_paid: {
    label: "Undo payment",
    title: "Undo the payment?",
    description: "It goes back to approved, and the payment details are cleared.",
    failed: "Couldn't undo the payment",
    done: "Payment undone.",
  },
};

const RESUBMIT: ActionCopy = {
  label: "Resubmit",
  title: "Resubmit it?",
  description: "It goes back for review with what was missing.",
  failed: "Couldn't resubmit it",
  done: "Resubmitted.",
};

export function actionCopy(action: RequestAction, status: RequestStatus): ActionCopy {
  return action === "submit" && status === "needs_info" ? RESUBMIT : COPY[action];
}

const ID_PREFIX = "action";
const NOTE_ID = `${ID_PREFIX}-note`;

/** Where to send focus for each field's error, in the order they appear. */
const FIELD_IDS: [Exclude<RequestActionField, "receipts">, string][] = [
  ["note", NOTE_ID],
  ["paid_date", paymentFieldId(ID_PREFIX, "paid_date")],
  ["payment_reference", paymentFieldId(ID_PREFIX, "payment_reference")],
  ["external_approver", paymentFieldId(ID_PREFIX, "external_approver")],
];

type Callbacks = {
  onDone: (message: string) => void;
  /** The request changed since the page loaded, so the page should reload it. */
  onStale: () => void;
};

/**
 * Confirms a status change and collects what it needs: a note, the payment,
 * or who approved it. A bottom sheet on phones and a centered panel on wider
 * screens.
 */
export function ActionSheet({
  opened,
  request,
  selfPayee,
  allowExternalApproval,
  onClose,
  onDone,
  onStale,
}: Callbacks & {
  opened: OpenedAction | null;
  request: ActionRequest;
  selfPayee: boolean;
  allowExternalApproval: boolean;
  onClose: () => void;
}) {
  // Keep showing the last action while the sheet animates closed.
  const [last, setLast] = useState(opened);
  if (opened !== null && opened !== last) setLast(opened);
  const current = opened ?? last;
  const [busy, setBusy] = useState(false);
  const copy = current && actionCopy(current.action, request.status);

  return (
    <Sheet open={opened !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <ResponsiveSheetContent>
        {current && copy && (
          <>
            <SheetHeader className="pr-12">
              <SheetTitle>{copy.title}</SheetTitle>
              <SheetDescription>
                {formatRequestNumber(request.requestNumber)} · {formatCents(request.amountCents)} to{" "}
                {request.payeeName}. {copy.description}
              </SheetDescription>
            </SheetHeader>
            <ActionForm
              key={current.key}
              action={current.action}
              today={current.today}
              copy={copy}
              request={request}
              selfPayee={selfPayee}
              allowExternalApproval={allowExternalApproval}
              onBusyChange={setBusy}
              onDone={onDone}
              onStale={onStale}
            />
          </>
        )}
      </ResponsiveSheetContent>
    </Sheet>
  );
}

function ActionForm({
  action,
  today,
  copy,
  request,
  selfPayee,
  allowExternalApproval,
  onBusyChange,
  onDone,
  onStale,
}: Callbacks & {
  action: RequestAction;
  today: IsoDate;
  copy: ActionCopy;
  request: ActionRequest;
  selfPayee: boolean;
  allowExternalApproval: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [values, setValues] = useState<RequestActionValues>({
    note: "",
    external_approver: "",
    payment_method: "cash_app",
    payment_reference: "",
    paid_date: today,
  });
  const [errors, setErrors] = useState<RequestActionErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const context: SaveContext = {
    today,
    purchaseDate: request.purchaseDate,
    selfPayee,
    allowExternalApproval,
    receiptCount: request.receiptCount,
    noReceipt: request.noReceipt,
  };
  const receiptBlocked = blockedByReceiptRule(action, context);

  function setValue<K extends keyof RequestActionValues>(key: K, value: RequestActionValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    if (key in errors) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function setBusy(busy: boolean) {
    setPending(busy);
    onBusyChange(busy);
  }

  async function run() {
    const checked = validateRequestAction(action, values, context);
    if (!checked.success) {
      setErrors(checked.errors);
      const first = FIELD_IDS.find(([field]) => checked.errors[field]);
      if (first) document.getElementById(first[1])?.focus();
      return;
    }

    setErrors({});
    setFormError(null);
    setBusy(true);
    let error: Awaited<ReturnType<typeof applyRequestAction>>;
    try {
      error = await applyRequestAction(createClient(), request.id, checked.data);
    } catch {
      error = {};
    }
    setBusy(false);

    if (error) {
      setFormError(appErrorMessage(error) ?? RETRY_MESSAGE);
      // Someone else got to it first. Reload the page so it shows where things stand.
      if (isWrongStatusError(error)) onStale();
      return;
    }
    onDone(copy.done);
  }

  return (
    <form
      noValidate
      className="space-y-4 px-4"
      onSubmit={(event) => {
        event.preventDefault();
        void run();
      }}
    >
      {formError && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>{copy.failed}</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      {receiptBlocked && (
        <Alert role="note">
          <InfoIcon />
          <AlertDescription>
            It needs a receipt first. Edit it to add one, or mark it as having no receipt and say why.
          </AlertDescription>
        </Alert>
      )}

      {isNoteAction(action) && (
        <FormField
          id={NOTE_ID}
          label={action === "request_info" ? "What's missing" : "Reason"}
          hint="Kept in the request's history."
          error={errors.note}
        >
          <Textarea
            id={NOTE_ID}
            name="note"
            value={values.note}
            onChange={(event) => setValue("note", event.target.value)}
            rows={3}
            maxLength={MAX_NOTE}
            disabled={pending}
            aria-invalid={errors.note ? true : undefined}
            aria-describedby={describedBy(NOTE_ID, errors.note, true)}
          />
        </FormField>
      )}

      {recordsPayment(action) && (
        <PaymentFields
          idPrefix={ID_PREFIX}
          values={values}
          onChange={setValue}
          errors={errors}
          purchaseDate={request.purchaseDate}
          today={today}
          disabled={pending}
        />
      )}

      {needsExternalApprover(action, context) && (
        <ApproverField
          idPrefix={ID_PREFIX}
          value={values.external_approver}
          onChange={(value) => setValue("external_approver", value)}
          error={errors.external_approver}
          disabled={pending}
        />
      )}

      {/* "Go back" comes first so a PC focuses it when the dialog opens, but it shows below on phones. */}
      <div className="flex flex-col-reverse gap-2 pt-2 desktop:flex-row desktop:justify-end">
        <SheetClose asChild>
          <Button type="button" variant="outline" className="h-11 desktop:min-w-28" disabled={pending}>
            Go back
          </Button>
        </SheetClose>
        <Button
          type="submit"
          variant={copy.destructive ? "destructive" : "default"}
          className="h-11 desktop:min-w-28"
          disabled={pending || receiptBlocked}
        >
          {pending ? "Saving…" : copy.label}
        </Button>
      </div>
    </form>
  );
}

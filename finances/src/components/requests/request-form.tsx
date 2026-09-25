"use client";

import { useEffect, useRef, useState, type ChangeEvent, type RefObject } from "react";
import Link from "next/link";
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { describedBy, FormField } from "@/components/form-field";
import { ReceiptPicker } from "@/components/receipts/receipt-picker";
import { usePendingReceipts } from "@/components/receipts/use-pending-receipts";
import { PayeePicker } from "@/components/requests/payee-picker";
import { saveFieldId, SaveOptions } from "@/components/requests/save-options";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { todayInLA, type IsoDate } from "@/lib/dates";
import { centsToDecimal, formatCents, parseAmountToCents } from "@/lib/money";
import type { PayeeRow } from "@/lib/payees/columns";
import { MAX_RECEIPTS, uploadReceipt } from "@/lib/receipts/upload";
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
import { formatRequestNumber, REQUEST_TYPE_LABELS } from "@/lib/requests/format";
import {
  FUTURE_DATE_CODE,
  MAX_NO_RECEIPT_REASON,
  MAX_REQUEST_CENTS,
  MIN_PURCHASE_DATE,
  REQUEST_TYPES,
  requestFieldErrors,
  requestSaveErrorMessage,
  requestSchema,
  type RequestField,
  type RequestFieldErrors,
  type RequestFormValues,
  type RequestType,
} from "@/lib/requests/schema";
import { createClient } from "@/lib/supabase/client";

type TextField = Exclude<RequestField, "payee_id" | "type">;

type FormErrors = RequestFieldErrors & SaveOptionErrors;

type ErrorField = keyof FormErrors;

/** Every field that can show an error, in the order they appear on screen. */
const ERROR_FIELDS: ErrorField[] = [
  "payee_id",
  "type",
  "amount",
  "purchase_date",
  "vendor",
  "description",
  "event_name",
  "receipts",
  "no_receipt_reason",
  "paid_date",
  "payment_reference",
  "external_approver",
];

const fieldId = (key: RequestField | "receipts" | "no_receipt") => `request-${key}`;

/** Groups have no single control, so focus their first option. */
function focusId(key: ErrorField): string {
  if (key === "type") return `request-type-${REQUEST_TYPES[0]}`;
  if (key === "paid_date" || key === "payment_reference" || key === "external_approver") return saveFieldId(key);
  return fieldId(key);
}

function blankRequest(today: IsoDate): RequestFormValues {
  return {
    payee_id: "",
    type: "",
    amount: "",
    purchase_date: today,
    vendor: "",
    description: "",
    event_name: "",
    no_receipt: false,
    no_receipt_reason: "",
  };
}

function receiptHint(count: number): string {
  if (count === 0) return `Photos or PDFs, up to ${MAX_RECEIPTS}.`;
  if (count < MAX_RECEIPTS) return `${count} of ${MAX_RECEIPTS} added.`;
  return `${MAX_RECEIPTS} of ${MAX_RECEIPTS} added, the most a request can have.`;
}

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

  function set<K extends RequestField>(key: K, value: RequestFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
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

  function textProps(key: TextField, hint?: boolean) {
    const id = fieldId(key);
    return {
      id,
      name: key,
      value: values[key],
      "aria-invalid": errors[key] ? true : undefined,
      "aria-describedby": describedBy(id, errors[key], hint),
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, event.target.value),
    };
  }

  function showFieldErrors(next: FormErrors) {
    setErrors(next);
    const first = ERROR_FIELDS.find((key) => next[key]);
    if (first) document.getElementById(focusId(first))?.focus();
  }

  /** Tidies a valid amount, e.g. "$1,234.5" -> "1234.50". */
  function normalizeAmount() {
    const cents = parseAmountToCents(values.amount);
    if (cents !== null && cents <= MAX_REQUEST_CENTS) {
      setValues((current) => ({ ...current, amount: centsToDecimal(cents) }));
    }
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
        ...(parsed.success ? {} : requestFieldErrors(parsed.error)),
        ...(action.success ? {} : action.errors),
      });
      return;
    }

    setErrors({});
    setFormError(null);
    setPending(true);
    const supabase = createClient();
    const requests = supabase.from("reimbursement_requests");
    const { data, error } = await (requestId
      ? requests.update(parsed.data).eq("id", requestId)
      : requests.insert(parsed.data)
    )
      .select("id, request_number")
      .single();

    if (error) {
      setPending(false);
      const message = requestSaveErrorMessage(error);
      if (error.code === FUTURE_DATE_CODE) showFieldErrors({ purchase_date: message });
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
        await uploadReceipt(supabase, data.id, receipt.prepared);
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
          ? "The draft is saved, but 1 receipt didn't upload. Save again to retry, or remove it."
          : `The draft is saved, but ${failed} receipts didn't upload. Save again to retry, or remove them.`,
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

  function setNoReceipt(on: boolean) {
    setValues((current) => ({ ...current, no_receipt: on }));
    setErrors((current) => ({ ...current, receipts: undefined, no_receipt_reason: undefined }));
  }

  function addReceipts(files: File[]) {
    setErrors((current) => ({ ...current, receipts: undefined }));
    pendingReceipts.add(files);
  }

  if (saved) return <SavedPanel saved={saved} heading={heading} onEnterAnother={enterAnother} />;

  const typeInvalid = errors.type ? true : undefined;

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

      <FormField id={fieldId("payee_id")} label="Payee" error={errors.payee_id} group>
        <PayeePicker
          id={fieldId("payee_id")}
          labelId={`${fieldId("payee_id")}-label`}
          payees={payees}
          value={values.payee_id}
          onChange={(payeeId) => set("payee_id", payeeId)}
          onAdded={(added) =>
            setPayees((current) =>
              [...current, added].sort((a, b) => a.full_name.localeCompare(b.full_name)),
            )
          }
          invalid={Boolean(errors.payee_id)}
          describedBy={describedBy(fieldId("payee_id"), errors.payee_id)}
        />
      </FormField>

      <FormField id={fieldId("type")} label="Type" error={errors.type} group>
        <RadioGroup
          value={values.type}
          onValueChange={(value) => set("type", value as RequestType)}
          aria-labelledby={`${fieldId("type")}-label`}
          aria-describedby={describedBy(fieldId("type"), errors.type)}
          aria-invalid={typeInvalid}
          className="grid-cols-2 gap-3"
        >
          {REQUEST_TYPES.map((type) => (
            <Label
              key={type}
              htmlFor={`request-type-${type}`}
              className="h-11 cursor-pointer rounded-lg border px-3 text-base font-normal has-[[aria-invalid=true]]:border-destructive has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-muted md:text-sm"
            >
              <RadioGroupItem id={`request-type-${type}`} value={type} aria-invalid={typeInvalid} />
              {REQUEST_TYPE_LABELS[type]}
            </Label>
          ))}
        </RadioGroup>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField id={fieldId("amount")} label="Amount" error={errors.amount}>
          <div className="relative">
            <span
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            >
              $
            </span>
            <Input
              {...textProps("amount")}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              onBlur={normalizeAmount}
              className="h-11 pl-6 tabular-nums"
            />
          </div>
        </FormField>

        <FormField id={fieldId("purchase_date")} label="Purchase date" error={errors.purchase_date}>
          <Input
            {...textProps("purchase_date")}
            type="date"
            min={MIN_PURCHASE_DATE}
            max={today}
            className="h-11 [&::-webkit-date-and-time-value]:text-left"
          />
        </FormField>
      </div>

      <FormField id={fieldId("vendor")} label="Vendor" hint="The store or website." error={errors.vendor}>
        <Input {...textProps("vendor", true)} autoComplete="off" autoCapitalize="words" maxLength={100} className="h-11" />
      </FormField>

      <FormField id={fieldId("description")} label="Description" hint="What was bought and why." error={errors.description}>
        <Textarea {...textProps("description", true)} rows={3} maxLength={1000} />
      </FormField>

      <FormField id={fieldId("event_name")} label="Event" optional hint="Like a retreat or camp." error={errors.event_name}>
        <Input
          {...textProps("event_name", true)}
          list={eventNames.length > 0 ? "request-event-suggestions" : undefined}
          autoComplete="off"
          autoCapitalize="words"
          maxLength={100}
          className="h-11"
        />
      </FormField>
      {eventNames.length > 0 && (
        <datalist id="request-event-suggestions">
          {eventNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      )}

      <FormField
        id={fieldId("receipts")}
        label="Receipts"
        hint={receiptHint(receipts.length)}
        error={errors.receipts}
        group
      >
        {!values.no_receipt && (
          <ReceiptPicker
            id={fieldId("receipts")}
            receipts={receipts}
            problems={pendingReceipts.problems}
            onAdd={addReceipts}
            onRemove={pendingReceipts.remove}
            locked={pending}
            describedBy={describedBy(fieldId("receipts"), errors.receipts, true)}
          />
        )}
        {receipts.length === 0 && (
          <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2">
            <Label htmlFor={fieldId("no_receipt")} className="text-base font-normal md:text-sm">
              No receipt on file
            </Label>
            <Switch
              id={fieldId("no_receipt")}
              checked={values.no_receipt}
              onCheckedChange={setNoReceipt}
              disabled={pending}
            />
          </div>
        )}
      </FormField>

      {values.no_receipt && (
        <FormField
          id={fieldId("no_receipt_reason")}
          label="Why there's no receipt"
          hint="Like a lost receipt, or backfilled from payment history."
          error={errors.no_receipt_reason}
        >
          <Textarea {...textProps("no_receipt_reason", true)} rows={2} maxLength={MAX_NO_RECEIPT_REASON} />
        </FormField>
      )}

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
          {formatRequestNumber(saved.requestNumber)}: <span className="tabular-nums">{formatCents(saved.amountCents)}</span>{" "}
          for {saved.payeeName}
        </p>
      </div>

      <div className="space-y-3">
        <Button type="button" className="h-11 w-full" onClick={onEnterAnother}>
          Enter another
        </Button>
        <Button variant="outline" className="h-11 w-full" asChild>
          <Link href={`/admin/requests/${saved.id}`}>View request</Link>
        </Button>
      </div>
    </div>
  );
}

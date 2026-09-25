"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleAlertIcon } from "lucide-react";
import { describedBy, FormField } from "@/components/form-field";
import { ReceiptPicker } from "@/components/receipts/receipt-picker";
import { usePendingReceipts } from "@/components/receipts/use-pending-receipts";
import { PayeePicker } from "@/components/requests/payee-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { todayInLA, type IsoDate } from "@/lib/dates";
import { centsToDecimal, parseAmountToCents } from "@/lib/money";
import type { PayeeRow } from "@/lib/payees/columns";
import { MAX_RECEIPTS, uploadReceipt } from "@/lib/receipts/upload";
import { REQUEST_TYPE_LABELS } from "@/lib/requests/format";
import {
  FUTURE_DATE_CODE,
  MAX_NO_RECEIPT_REASON,
  MAX_REQUEST_CENTS,
  MIN_PURCHASE_DATE,
  REQUEST_FIELDS,
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

const fieldId = (key: RequestField | "receipts" | "no_receipt") => `request-${key}`;

/** The type group has no single control, so focus its first option. */
const focusId = (key: RequestField) => (key === "type" ? `request-type-${REQUEST_TYPES[0]}` : fieldId(key));

function receiptHint(count: number): string {
  if (count === 0) return `Photos or PDFs, up to ${MAX_RECEIPTS}.`;
  if (count < MAX_RECEIPTS) return `${count} of ${MAX_RECEIPTS} added.`;
  return `${MAX_RECEIPTS} of ${MAX_RECEIPTS} added, the most a request can have.`;
}

/**
 * The admin's main entry form. Built for speed on a phone: big touch targets,
 * the right keyboard for each field, and today's date filled in.
 */
export function RequestForm({
  payees: initialPayees,
  eventNames,
  today,
}: {
  /** Active payees, sorted by name. */
  payees: PayeeRow[];
  /** Recent event names, offered as suggestions. */
  eventNames: string[];
  /** Today in Los Angeles, from the server so the first render matches. */
  today: IsoDate;
}) {
  const router = useRouter();
  const [payees, setPayees] = useState(initialPayees);
  const [values, setValues] = useState<RequestFormValues>({
    payee_id: "",
    type: "",
    amount: "",
    purchase_date: today,
    vendor: "",
    description: "",
    event_name: "",
    no_receipt: false,
    no_receipt_reason: "",
  });
  const [errors, setErrors] = useState<RequestFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Set once the draft exists, so a retry after a failed upload updates it instead of adding another.
  const [requestId, setRequestId] = useState<string | null>(null);
  const pendingReceipts = usePendingReceipts();
  const { receipts } = pendingReceipts;
  const preparing = receipts.some((receipt) => receipt.status === "processing");

  function set<K extends RequestField>(key: K, value: RequestFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
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

  function showFieldErrors(next: RequestFieldErrors) {
    setErrors(next);
    const first = REQUEST_FIELDS.find((key) => next[key]);
    if (first) document.getElementById(focusId(first))?.focus();
  }

  /** Tidies a valid amount, e.g. "$1,234.5" -> "1234.50". */
  function normalizeAmount() {
    const cents = parseAmountToCents(values.amount);
    if (cents !== null && cents <= MAX_REQUEST_CENTS) {
      setValues((current) => ({ ...current, amount: centsToDecimal(cents) }));
    }
  }

  async function saveDraft() {
    if (preparing) return;
    // Checked against today at save time, in case the page sat open past midnight.
    const parsed = requestSchema(todayInLA()).safeParse(values);
    if (!parsed.success) {
      showFieldErrors(requestFieldErrors(parsed.error));
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
      .select("id")
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
    // Stay pending while the detail page loads, so the draft can't be saved twice.
    router.push(`/admin/requests/${data.id}`);
  }

  function setNoReceipt(on: boolean) {
    setValues((current) => ({ ...current, no_receipt: on }));
    setErrors((current) => ({ ...current, no_receipt_reason: undefined }));
  }

  const typeInvalid = errors.type ? true : undefined;

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void saveDraft();
      }}
    >
      <h1 className="text-2xl font-semibold tracking-tight">New request</h1>

      <FormField id={fieldId("payee_id")} label="Payee" error={errors.payee_id} group>
        <PayeePicker
          id={fieldId("payee_id")}
          labelId={`${fieldId("payee_id")}-label`}
          payees={payees}
          value={values.payee_id}
          onChange={(payeeId) => set("payee_id", payeeId)}
          onAdded={(payee) =>
            setPayees((current) =>
              [...current, payee].sort((a, b) => a.full_name.localeCompare(b.full_name)),
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

      <FormField id={fieldId("receipts")} label="Receipts" hint={receiptHint(receipts.length)} group>
        {!values.no_receipt && (
          <ReceiptPicker
            id={fieldId("receipts")}
            receipts={receipts}
            problems={pendingReceipts.problems}
            onAdd={pendingReceipts.add}
            onRemove={pendingReceipts.remove}
            locked={pending}
            describedBy={describedBy(fieldId("receipts"), undefined, true)}
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

      {/* Next to the button, since that's where the eye is after tapping it on a phone. */}
      {formError && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="h-11 w-full" disabled={pending || preparing}>
        {pending ? "Saving…" : preparing ? "Preparing receipts…" : "Save draft"}
      </Button>
    </form>
  );
}

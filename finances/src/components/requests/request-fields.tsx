"use client";

import type { ChangeEvent, ReactNode } from "react";
import { describedBy, FormField } from "@/components/form-field";
import { ReceiptPicker } from "@/components/receipts/receipt-picker";
import type { PendingReceipts } from "@/components/receipts/use-pending-receipts";
import { PayeePicker } from "@/components/requests/payee-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { IsoDate } from "@/lib/dates";
import { centsToDecimal, parseAmountToCents } from "@/lib/money";
import type { PayeeRow } from "@/lib/payees/columns";
import { MAX_RECEIPTS } from "@/lib/receipts/upload";
import { REQUEST_TYPE_LABELS } from "@/lib/requests/format";
import {
  MAX_NO_RECEIPT_REASON,
  MAX_REQUEST_CENTS,
  MIN_PURCHASE_DATE,
  REQUEST_TYPES,
  type RequestField,
  type RequestFieldErrors,
  type RequestFormValues,
  type RequestType,
} from "@/lib/requests/schema";

export type RequestFormErrors = RequestFieldErrors & { receipts?: string };

type TextField = Exclude<RequestField, "payee_id" | "type">;

export const requestFieldId = (key: RequestField | "receipts" | "no_receipt") => `request-${key}`;

/** The fields that can show an error, in the order they appear on screen. */
export const REQUEST_ERROR_FIELDS = [
  "payee_id",
  "type",
  "amount",
  "purchase_date",
  "vendor",
  "description",
  "event_name",
  "receipts",
  "no_receipt_reason",
] as const satisfies readonly (keyof RequestFormErrors)[];

/** Where focus goes for a field's error. The type is a group, so its first option. */
export function requestFocusId(key: keyof RequestFormErrors): string {
  return key === "type" ? `request-type-${REQUEST_TYPES[0]}` : requestFieldId(key);
}

export function blankRequest(today: IsoDate): RequestFormValues {
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

/**
 * The purchase itself: payee, type, amount, date, vendor, description, event,
 * and receipts. Shared by the new and edit forms, which own the values and
 * how they're saved.
 */
export function RequestFields({
  values,
  errors,
  onChange,
  payees,
  onPayeeAdded,
  eventNames,
  today,
  pendingReceipts,
  savedReceipts,
  receiptCount,
  onAddReceipts,
  locked,
}: {
  values: RequestFormValues;
  errors: RequestFormErrors;
  onChange: <K extends keyof RequestFormValues>(key: K, value: RequestFormValues[K]) => void;
  /** Sorted by name. */
  payees: PayeeRow[];
  onPayeeAdded: (payee: PayeeRow) => void;
  /** Recent event names, offered as suggestions. */
  eventNames: string[];
  today: IsoDate;
  /** Receipts picked here and not saved yet. */
  pendingReceipts: PendingReceipts;
  /** Receipts already saved with the request, shown above the picker. */
  savedReceipts?: ReactNode;
  /** How many receipts it will have once saved. */
  receiptCount: number;
  onAddReceipts: (files: File[]) => void;
  /** True while saving, so nothing changes mid-upload. */
  locked: boolean;
}) {
  function textProps(key: TextField, hint?: boolean) {
    const id = requestFieldId(key);
    return {
      id,
      name: key,
      value: values[key],
      "aria-invalid": errors[key] ? true : undefined,
      "aria-describedby": describedBy(id, errors[key], hint),
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(key, event.target.value),
    };
  }

  /** Tidies a valid amount, e.g. "$1,234.5" -> "1234.50". */
  function normalizeAmount() {
    const cents = parseAmountToCents(values.amount);
    if (cents !== null && cents <= MAX_REQUEST_CENTS) onChange("amount", centsToDecimal(cents));
  }

  const typeInvalid = errors.type ? true : undefined;

  return (
    <>
      <FormField id={requestFieldId("payee_id")} label="Payee" error={errors.payee_id} group>
        <PayeePicker
          id={requestFieldId("payee_id")}
          labelId={`${requestFieldId("payee_id")}-label`}
          payees={payees}
          value={values.payee_id}
          onChange={(payeeId) => onChange("payee_id", payeeId)}
          onAdded={onPayeeAdded}
          invalid={Boolean(errors.payee_id)}
          describedBy={describedBy(requestFieldId("payee_id"), errors.payee_id)}
        />
      </FormField>

      <FormField id={requestFieldId("type")} label="Type" error={errors.type} group>
        <RadioGroup
          value={values.type}
          onValueChange={(value) => onChange("type", value as RequestType)}
          aria-labelledby={`${requestFieldId("type")}-label`}
          aria-describedby={describedBy(requestFieldId("type"), errors.type)}
          aria-invalid={typeInvalid}
          className="grid-cols-2 gap-3"
        >
          {REQUEST_TYPES.map((type) => (
            <Label
              key={type}
              htmlFor={`request-type-${type}`}
              className="h-11 cursor-pointer rounded-lg border px-3 text-base font-normal has-[[aria-invalid=true]]:border-destructive has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-muted desktop:text-sm"
            >
              <RadioGroupItem id={`request-type-${type}`} value={type} aria-invalid={typeInvalid} />
              {REQUEST_TYPE_LABELS[type]}
            </Label>
          ))}
        </RadioGroup>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField id={requestFieldId("amount")} label="Amount" error={errors.amount}>
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

        <FormField id={requestFieldId("purchase_date")} label="Purchase date" error={errors.purchase_date}>
          <Input
            {...textProps("purchase_date")}
            type="date"
            min={MIN_PURCHASE_DATE}
            max={today}
            className="h-11"
          />
        </FormField>
      </div>

      <FormField
        id={requestFieldId("vendor")}
        label="Vendor"
        recommended
        hint="The store or website."
        error={errors.vendor}
      >
        <Input {...textProps("vendor", true)} autoComplete="off" autoCapitalize="words" maxLength={100} className="h-11" />
      </FormField>

      <FormField
        id={requestFieldId("description")}
        label="Description"
        recommended
        hint="What was bought and why."
        error={errors.description}
      >
        <Textarea {...textProps("description", true)} rows={3} maxLength={1000} />
      </FormField>

      <FormField
        id={requestFieldId("event_name")}
        label="Event"
        optional
        hint="Like a retreat or camp."
        error={errors.event_name}
      >
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
        id={requestFieldId("receipts")}
        label="Receipts"
        hint={receiptHint(receiptCount)}
        error={errors.receipts}
        group
      >
        {savedReceipts}
        {!values.no_receipt && (
          <ReceiptPicker
            id={requestFieldId("receipts")}
            receipts={pendingReceipts.receipts}
            problems={pendingReceipts.problems}
            max={pendingReceipts.limit}
            onAdd={onAddReceipts}
            onRemove={pendingReceipts.remove}
            locked={locked}
            describedBy={describedBy(requestFieldId("receipts"), errors.receipts, true)}
          />
        )}
        {receiptCount === 0 && (
          <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2">
            <Label htmlFor={requestFieldId("no_receipt")} className="text-base font-normal desktop:text-sm">
              No receipt on file
            </Label>
            <Switch
              id={requestFieldId("no_receipt")}
              checked={values.no_receipt}
              onCheckedChange={(on) => onChange("no_receipt", on)}
              disabled={locked}
            />
          </div>
        )}
      </FormField>

      {values.no_receipt && (
        <FormField
          id={requestFieldId("no_receipt_reason")}
          label="Why there's no receipt"
          hint="Like a lost receipt, or backfilled from payment history."
          error={errors.no_receipt_reason}
        >
          <Textarea {...textProps("no_receipt_reason", true)} rows={2} maxLength={MAX_NO_RECEIPT_REASON} />
        </FormField>
      )}
    </>
  );
}

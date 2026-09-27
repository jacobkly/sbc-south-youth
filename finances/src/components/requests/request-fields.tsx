"use client";

import { useEffect, useRef, type ChangeEvent, type ReactNode } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { describedBy, FormField } from "@/components/form-field";
import { pickedTwice, ReceiptPicker } from "@/components/receipts/receipt-picker";
import type { PendingReceipts } from "@/components/receipts/use-pending-receipts";
import { PayeePicker } from "@/components/requests/payee-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { IsoDate } from "@/lib/dates";
import { centsToDecimal, formatCents, parseAmountToCents } from "@/lib/money";
import type { PayeeRow } from "@/lib/payees/columns";
import { MAX_RECEIPTS } from "@/lib/receipts/upload";
import { REQUEST_TYPE_LABELS } from "@/lib/requests/format";
import { blankLine, enteredTotal, MAX_LINES, type RequestLineValues } from "@/lib/requests/lines";
import {
  MAX_NO_RECEIPT_REASON,
  MAX_REQUEST_CENTS,
  MIN_PURCHASE_DATE,
  REQUEST_TYPES,
  type LineField,
  type RequestField,
  type RequestFieldErrors,
  type RequestFormValues,
  type RequestType,
} from "@/lib/requests/schema";

export type RequestFormErrors = RequestFieldErrors & { receipts?: string };

type TextField = Exclude<RequestField, "payee_id" | "type">;

export const requestFieldId = (key: RequestField | "receipts" | "no_receipt" | "total") => `request-${key}`;

/**
 * A receipt's field, by its place in the list. Line ids stay out of the page,
 * since they're random and the server and browser would render different ones.
 */
export const lineFieldId = (index: number, field: LineField | "files") => `request-line-${index}-${field}`;

/** Where focus goes for a field's error. The type is a group, so its first option. */
function requestFocusId(key: Exclude<keyof RequestFormErrors, "lines">): string {
  return key === "type" ? `request-type-${REQUEST_TYPES[0]}` : requestFieldId(key);
}

/**
 * The ids of the fields showing an error, in the order they appear on screen.
 * With one receipt its amount and vendor sit among the request's fields, as
 * they always have. With several, each receipt comes after the request's own.
 */
export function requestErrorIds(errors: RequestFormErrors, lines: readonly RequestLineValues[]): string[] {
  const field = (key: Exclude<keyof RequestFormErrors, "lines">) => (errors[key] ? [requestFocusId(key)] : []);
  const line = (index: number, fields: readonly LineField[]) =>
    fields.filter((name) => errors.lines?.[lines[index].id]?.[name]).map((name) => lineFieldId(index, name));
  const receipts = errors.receipts ? [lines.length === 1 ? requestFieldId("receipts") : lineFieldId(0, "files")] : [];

  if (lines.length === 1) {
    return [
      ...field("payee_id"),
      ...field("type"),
      ...line(0, ["amount"]),
      ...field("purchase_date"),
      ...line(0, ["vendor"]),
      ...field("description"),
      ...field("event_name"),
      ...field("total"),
      ...receipts,
      ...field("no_receipt_reason"),
    ];
  }
  return [
    ...field("payee_id"),
    ...field("type"),
    ...field("purchase_date"),
    ...field("description"),
    ...field("event_name"),
    ...lines.flatMap((_, index) => line(index, ["amount", "vendor"])),
    ...field("total"),
    ...receipts,
    ...field("no_receipt_reason"),
  ];
}

export function blankRequest(today: IsoDate): RequestFormValues {
  return {
    payee_id: "",
    type: "",
    purchase_date: today,
    lines: [blankLine()],
    description: "",
    event_name: "",
    no_receipt: false,
    no_receipt_reason: "",
  };
}

function receiptHint(count: number): string {
  if (count === 0) return `Photos or PDFs, up to ${MAX_RECEIPTS} files.`;
  if (count < MAX_RECEIPTS) return `${count} of ${MAX_RECEIPTS} files added.`;
  return `${MAX_RECEIPTS} of ${MAX_RECEIPTS} files added, the most a request can have.`;
}

/**
 * The purchase itself: payee, type, date, description, event, and its
 * receipts, each with an amount, a vendor, and files. Shared by the new and
 * edit forms, which own the values and how they're saved.
 *
 * Most requests have one receipt, so that looks like a single purchase. "Add
 * another receipt" turns it into a list with a total.
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
  /** Files picked here and not saved yet. */
  pendingReceipts: PendingReceipts;
  /**
   * A receipt's files that are already saved, shown above its picker. `title`
   * names the receipt, like "Receipt 2", when there are several.
   */
  savedReceipts?: (lineId: string, title?: string) => ReactNode;
  /** How many files it will have once saved. */
  receiptCount: number;
  onAddReceipts: (files: File[], lineId: string) => void;
  /** True while saving, so nothing changes mid-upload. */
  locked: boolean;
}) {
  const { lines } = values;
  const single = lines.length === 1;
  const picked = pendingReceipts.receipts;
  const repeats = pickedTwice(picked);
  // Files that can still be picked, on any receipt.
  const room = Math.max(0, pendingReceipts.limit - picked.length);

  // After adding or removing a receipt, focus moves to an amount once it's on screen.
  const focusAfterRender = useRef<string | null>(null);
  useEffect(() => {
    const id = focusAfterRender.current;
    if (!id) return;
    focusAfterRender.current = null;
    document.getElementById(id)?.focus();
  }, [lines]);

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

  function setLine(index: number, change: Partial<RequestLineValues>) {
    onChange(
      "lines",
      lines.map((line, i) => (i === index ? { ...line, ...change } : line)),
    );
  }

  function addLine() {
    focusAfterRender.current = lineFieldId(lines.length, "amount");
    onChange("lines", [...lines, blankLine()]);
  }

  function removeLine(index: number) {
    pendingReceipts.removeLine(lines[index].id);
    const next = lines.filter((_, i) => i !== index);
    focusAfterRender.current = lineFieldId(Math.min(index, next.length - 1), "amount");
    onChange("lines", next);
  }

  /** Files that belong to a saved draft now, after a save that stopped partway. They stay with their receipt. */
  function hasUploads(lineId: string): boolean {
    return picked.some((file) => file.line === lineId && (file.status === "uploaded" || file.status === "uploading"));
  }

  function lineInputProps(index: number, field: LineField, hint?: boolean) {
    const line = lines[index];
    const id = lineFieldId(index, field);
    const error = errors.lines?.[line.id]?.[field];
    return {
      id,
      name: `lines.${index}.${field}`,
      value: line[field],
      "aria-invalid": error ? true : undefined,
      "aria-describedby": describedBy(id, error, hint),
      onChange: (event: ChangeEvent<HTMLInputElement>) => setLine(index, { [field]: event.target.value }),
    };
  }

  function amountField(index: number) {
    const line = lines[index];
    /** Tidies a valid amount, e.g. "$1,234.5" -> "1234.50". */
    function normalize() {
      const cents = parseAmountToCents(line.amount);
      if (cents !== null && cents <= MAX_REQUEST_CENTS) setLine(index, { amount: centsToDecimal(cents) });
    }
    return (
      <FormField id={lineFieldId(index, "amount")} label="Amount" error={errors.lines?.[line.id]?.amount}>
        <div className="relative">
          <span
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          >
            $
          </span>
          <Input
            {...lineInputProps(index, "amount")}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            onBlur={normalize}
            className="h-11 pl-6 tabular-nums"
          />
        </div>
      </FormField>
    );
  }

  function picker(index: number, compact: boolean) {
    const line = lines[index];
    const files = picked.filter((file) => file.line === line.id);
    const problems = pendingReceipts.problems.filter((problem) => problem.line === line.id);
    const errorId = describedBy(requestFieldId("receipts"), errors.receipts, true);
    return (
      <ReceiptPicker
        id={compact ? lineFieldId(index, "files") : requestFieldId("receipts")}
        receipts={files}
        problems={problems.map((problem) => problem.text)}
        max={files.length + room}
        label={compact ? `Receipt ${index + 1} files` : "Receipt files"}
        addLabel="Add photo"
        compact={compact}
        repeats={repeats}
        onAdd={(added) => onAddReceipts(added, line.id)}
        onRemove={pendingReceipts.remove}
        locked={locked}
        // Only the first receipt's button speaks for the whole list.
        describedBy={!compact || index === 0 ? errorId : undefined}
      />
    );
  }

  const noReceiptSwitch = receiptCount === 0 && (
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
  );

  const addLineButton = lines.length < MAX_LINES && (
    <Button type="button" variant="outline" className="h-11 w-full" onClick={addLine} disabled={locked}>
      <PlusIcon aria-hidden />
      Add another receipt
    </Button>
  );

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

      {single ? (
        <div className="grid grid-cols-2 gap-3">
          {amountField(0)}
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
      ) : (
        <FormField id={requestFieldId("purchase_date")} label="Purchase date" error={errors.purchase_date}>
          <Input {...textProps("purchase_date")} type="date" min={MIN_PURCHASE_DATE} max={today} className="h-11" />
        </FormField>
      )}

      {single && (
        <FormField
          id={lineFieldId(0, "vendor")}
          label="Vendor"
          recommended
          hint="The store or website."
          error={errors.lines?.[lines[0].id]?.vendor}
        >
          <Input
            {...lineInputProps(0, "vendor", true)}
            autoComplete="off"
            autoCapitalize="words"
            maxLength={100}
            className="h-11"
          />
        </FormField>
      )}

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

      {single ? (
        <>
          <FormField
            id={requestFieldId("receipts")}
            label="Receipt"
            hint={receiptHint(receiptCount)}
            error={errors.receipts}
            group
          >
            {savedReceipts?.(lines[0].id)}
            {!values.no_receipt && picker(0, false)}
            {noReceiptSwitch}
          </FormField>
          {addLineButton}
        </>
      ) : (
        <div role="group" aria-labelledby={`${requestFieldId("receipts")}-label`} className="min-w-0 space-y-3">
          <Label id={`${requestFieldId("receipts")}-label`}>Receipts</Label>
          <ol className="space-y-3">
            {lines.map((line, index) => {
              const headingId = `${lineFieldId(index, "files")}-heading`;
              return (
                <li
                  key={line.id}
                  role="group"
                  aria-labelledby={headingId}
                  className="space-y-3 rounded-lg border p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 id={headingId} className="text-sm font-medium">
                      Receipt {index + 1}
                    </h2>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="-my-2 -mr-2 size-11"
                      onClick={() => removeLine(index)}
                      disabled={locked || hasUploads(line.id)}
                      aria-label={`Remove receipt ${index + 1}`}
                    >
                      <XIcon />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {amountField(index)}
                    <FormField id={lineFieldId(index, "vendor")} label="Vendor" error={errors.lines?.[line.id]?.vendor}>
                      <Input
                        {...lineInputProps(index, "vendor")}
                        autoComplete="off"
                        autoCapitalize="words"
                        maxLength={100}
                        className="h-11"
                      />
                    </FormField>
                  </div>
                  {savedReceipts?.(line.id, `Receipt ${index + 1}`)}
                  {!values.no_receipt && picker(index, true)}
                </li>
              );
            })}
          </ol>

          {addLineButton}

          <div
            id={requestFieldId("total")}
            tabIndex={-1}
            aria-describedby={describedBy(requestFieldId("total"), errors.total)}
            className="flex items-baseline justify-between gap-3 rounded-lg bg-muted px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="font-medium">Total</span>
            <span className="text-lg font-semibold tabular-nums">{formatCents(enteredTotal(lines))}</span>
          </div>
          {errors.total && (
            <p id={`${requestFieldId("total")}-error`} className="text-sm text-destructive">
              {errors.total}
            </p>
          )}

          {errors.receipts ? (
            <p id={`${requestFieldId("receipts")}-error`} className="text-sm text-destructive">
              {errors.receipts}
            </p>
          ) : (
            <p id={`${requestFieldId("receipts")}-hint`} className="text-xs text-muted-foreground">
              {receiptHint(receiptCount)}
            </p>
          )}
          {noReceiptSwitch}
        </div>
      )}

      {values.no_receipt && (
        <FormField
          id={requestFieldId("no_receipt_reason")}
          label="Why there's no receipt"
          optional
          hint="Like a lost receipt, or backfilled from payment history."
          error={errors.no_receipt_reason}
        >
          <Textarea {...textProps("no_receipt_reason", true)} rows={2} maxLength={MAX_NO_RECEIPT_REASON} />
        </FormField>
      )}
    </>
  );
}

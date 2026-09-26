"use client";

import type { ChangeEvent } from "react";
import { describedBy, FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { isIsoDate, type IsoDate } from "@/lib/dates";
import {
  MAX_EXTERNAL_APPROVER,
  MAX_PAYMENT_REFERENCE,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type PaymentMethod,
  type PaymentValues,
} from "@/lib/requests/actions";
import { MIN_PURCHASE_DATE } from "@/lib/requests/schema";

/** A radio option drawn as a tappable tile. */
export const TILE =
  "h-11 cursor-pointer rounded-lg border px-3 text-base font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-muted desktop:text-sm";

/** A field's id. Each form passes its own prefix, so two forms on a page never share ids. */
export const paymentFieldId = (prefix: string, key: keyof PaymentValues | "external_approver") => `${prefix}-${key}`;

/**
 * How it was paid, the paid date, and an optional reference like a check
 * number. Works with any form whose values include the payment fields.
 */
export function PaymentFields<T extends PaymentValues>({
  idPrefix,
  values,
  onChange,
  errors,
  purchaseDate,
  today,
  disabled,
}: {
  idPrefix: string;
  values: T;
  onChange: <K extends keyof T>(key: K, value: T[K]) => void;
  errors: Partial<Record<"paid_date" | "payment_reference", string>>;
  purchaseDate: string;
  today: IsoDate;
  disabled?: boolean;
}) {
  const methodId = paymentFieldId(idPrefix, "payment_method");

  function textProps(key: "payment_reference" | "paid_date", hint?: boolean) {
    const id = paymentFieldId(idPrefix, key);
    return {
      id,
      name: key,
      value: values[key],
      disabled,
      "aria-invalid": errors[key] ? true : undefined,
      "aria-describedby": describedBy(id, errors[key], hint),
      onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(key, event.target.value as T[typeof key]),
    };
  }

  return (
    <>
      <FormField id={methodId} label="Paid with" group>
        <RadioGroup
          value={values.payment_method}
          onValueChange={(value) => onChange("payment_method", value as PaymentMethod as T["payment_method"])}
          aria-labelledby={`${methodId}-label`}
          disabled={disabled}
          className="grid-cols-2 gap-3"
        >
          {PAYMENT_METHODS.map((method) => (
            <Label key={method} htmlFor={`${methodId}-${method}`} className={TILE}>
              <RadioGroupItem id={`${methodId}-${method}`} value={method} />
              {PAYMENT_METHOD_LABELS[method]}
            </Label>
          ))}
        </RadioGroup>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField id={paymentFieldId(idPrefix, "paid_date")} label="Paid date" error={errors.paid_date}>
          <Input
            {...textProps("paid_date")}
            type="date"
            min={isIsoDate(purchaseDate) && purchaseDate <= today ? purchaseDate : MIN_PURCHASE_DATE}
            max={today}
            className="h-11"
          />
        </FormField>

        <FormField
          id={paymentFieldId(idPrefix, "payment_reference")}
          label="Reference"
          optional
          hint="Like a check number."
          error={errors.payment_reference}
        >
          <Input
            {...textProps("payment_reference", true)}
            autoComplete="off"
            maxLength={MAX_PAYMENT_REFERENCE}
            className="h-11"
          />
        </FormField>
      </div>
    </>
  );
}

/** Who approved a reimbursement paid to the admin entering it. */
export function ApproverField({
  idPrefix,
  value,
  onChange,
  error,
  disabled,
  hint = "This is paid to you, so enter who approved it.",
}: {
  idPrefix: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  hint?: string;
}) {
  const id = paymentFieldId(idPrefix, "external_approver");
  return (
    <FormField id={id} label="Approved by" hint={hint} error={error}>
      <Input
        id={id}
        name="external_approver"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, true)}
        autoComplete="off"
        autoCapitalize="words"
        maxLength={MAX_EXTERNAL_APPROVER}
        className="h-11"
      />
    </FormField>
  );
}

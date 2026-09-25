"use client";

import type { ChangeEvent } from "react";
import { InfoIcon, TriangleAlertIcon } from "lucide-react";
import { describedBy, FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { isIsoDate, type IsoDate } from "@/lib/dates";
import {
  MAX_EXTERNAL_APPROVER,
  MAX_PAYMENT_REFERENCE,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  SAVE_OPTION_LABELS,
  type PaymentMethod,
  type SaveOption,
  type SaveOptionErrors,
  type SaveOptionValues,
} from "@/lib/requests/actions";
import { MIN_PURCHASE_DATE } from "@/lib/requests/schema";

export const saveFieldId = (key: keyof SaveOptionValues) => `save-${key}`;

const optionItemId = (option: SaveOption) => `${saveFieldId("option")}-${option}`;

const OPTION_HINTS: Record<SaveOption, string> = {
  draft: "Keeps it as a draft to finish later.",
  submit: "Marks it ready for review.",
  approve: "Approves it now, to pay later.",
  paid: "Approves it and records the payment in one step, like for past payments.",
};

const TILE =
  "h-11 cursor-pointer rounded-lg border px-3 text-base font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-muted md:text-sm";

/**
 * How to save a new request: as a draft, submitted, approved, or already
 * paid. Shows the payment fields and "Approved by" only when they apply.
 */
export function SaveOptions({
  values,
  onChange,
  errors,
  options,
  approverRequired,
  selfApprovalBlocked,
  lateDays,
  lateLimitDays,
  purchaseDate,
  today,
  disabled,
}: {
  values: SaveOptionValues;
  onChange: <K extends keyof SaveOptionValues>(key: K, value: SaveOptionValues[K]) => void;
  errors: SaveOptionErrors;
  /** The options open for this payee. `values.option` is always one of them. */
  options: SaveOption[];
  approverRequired: boolean;
  /** The payee is the signed-in admin and external approval is off. */
  selfApprovalBlocked: boolean;
  /** Days since the purchase, when that's past the late-submission limit. */
  lateDays: number | null;
  lateLimitDays: number;
  purchaseDate: string;
  today: IsoDate;
  disabled?: boolean;
}) {
  const { option } = values;
  const optionId = saveFieldId("option");
  const methodId = saveFieldId("payment_method");

  function textProps(key: "external_approver" | "payment_reference" | "paid_date", hint?: boolean) {
    const id = saveFieldId(key);
    return {
      id,
      name: key,
      value: values[key],
      disabled,
      "aria-invalid": errors[key] ? true : undefined,
      "aria-describedby": describedBy(id, errors[key], hint),
      onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(key, event.target.value),
    };
  }

  return (
    <div className="space-y-5">
      <FormField id={optionId} label="Save as" hint={OPTION_HINTS[option]} group>
        <RadioGroup
          value={option}
          onValueChange={(value) => onChange("option", value as SaveOption)}
          aria-labelledby={`${optionId}-label`}
          aria-describedby={`${optionId}-hint`}
          disabled={disabled}
          className="grid-cols-2 gap-3"
        >
          {options.map((choice) => (
            <Label key={choice} htmlFor={optionItemId(choice)} className={TILE}>
              <RadioGroupItem id={optionItemId(choice)} value={choice} />
              {SAVE_OPTION_LABELS[choice]}
            </Label>
          ))}
        </RadioGroup>
      </FormField>

      {selfApprovalBlocked && (
        <Alert role="note">
          <InfoIcon />
          <AlertDescription>
            This is paid to you, so another admin has to approve it. You can save it as a draft or submit it.
          </AlertDescription>
        </Alert>
      )}

      {lateDays !== null && option !== "paid" && (
        <Alert role="status">
          <TriangleAlertIcon />
          <AlertDescription>
            Bought {lateDays} days ago. Requests are due within {lateLimitDays} days of purchase, but you can still
            save it.
          </AlertDescription>
        </Alert>
      )}

      {option === "paid" && (
        <>
          <FormField id={methodId} label="Paid with" group>
            <RadioGroup
              value={values.payment_method}
              onValueChange={(value) => onChange("payment_method", value as PaymentMethod)}
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
            <FormField id={saveFieldId("paid_date")} label="Paid date" error={errors.paid_date}>
              <Input
                {...textProps("paid_date")}
                type="date"
                min={isIsoDate(purchaseDate) && purchaseDate <= today ? purchaseDate : MIN_PURCHASE_DATE}
                max={today}
                className="h-11 [&::-webkit-date-and-time-value]:text-left"
              />
            </FormField>

            <FormField
              id={saveFieldId("payment_reference")}
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
      )}

      {approverRequired && (
        <FormField
          id={saveFieldId("external_approver")}
          label="Approved by"
          hint="This is paid to you, so enter who approved it."
          error={errors.external_approver}
        >
          <Input
            {...textProps("external_approver", true)}
            autoComplete="off"
            autoCapitalize="words"
            maxLength={MAX_EXTERNAL_APPROVER}
            className="h-11"
          />
        </FormField>
      )}
    </div>
  );
}

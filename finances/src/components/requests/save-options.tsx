"use client";

import { InfoIcon, TriangleAlertIcon } from "lucide-react";
import { FormField } from "@/components/form-field";
import { ApproverField, paymentFieldId, PaymentFields, TILE } from "@/components/requests/payment-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { IsoDate } from "@/lib/dates";
import {
  SAVE_OPTION_LABELS,
  type SaveOption,
  type SaveOptionErrors,
  type SaveOptionValues,
} from "@/lib/requests/actions";

const ID_PREFIX = "save";

export const saveFieldId = (key: keyof SaveOptionValues) =>
  key === "option" ? `${ID_PREFIX}-option` : paymentFieldId(ID_PREFIX, key);

const optionItemId = (option: SaveOption) => `${saveFieldId("option")}-${option}`;

const OPTION_HINTS: Record<SaveOption, string> = {
  draft: "Keeps it as a draft to finish later.",
  submit: "Marks it ready for review.",
  approve: "Approves it now, to pay later.",
  paid: "Approves it and records the payment in one step, like for past payments.",
};

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
        <PaymentFields
          idPrefix={ID_PREFIX}
          values={values}
          onChange={onChange}
          errors={errors}
          purchaseDate={purchaseDate}
          today={today}
          disabled={disabled}
        />
      )}

      {approverRequired && (
        <ApproverField
          idPrefix={ID_PREFIX}
          value={values.external_approver}
          onChange={(value) => onChange("external_approver", value)}
          error={errors.external_approver}
          disabled={disabled}
        />
      )}
    </div>
  );
}

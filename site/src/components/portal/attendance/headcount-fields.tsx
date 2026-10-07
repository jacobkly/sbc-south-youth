"use client";

import { describedBy, FormField } from "@/components/portal/form-field";
import { Input } from "@/components/portal/ui/input";
import type { IsoDate } from "@/lib/dates";
import type { HeadcountErrors, HeadcountValues } from "@/lib/portal/attendance/headcount";

/** A headcount's two fields, for adding a night and for fixing one. Ids are `${prefix}-night` and `${prefix}-total`. */
export function HeadcountFields({
  prefix,
  values,
  errors,
  nightHint,
  today,
  disabled,
  onChange,
}: {
  prefix: string;
  values: HeadcountValues;
  errors: HeadcountErrors;
  nightHint?: string;
  today: IsoDate;
  disabled: boolean;
  onChange: (field: keyof HeadcountValues, value: string) => void;
}) {
  const night = `${prefix}-night`;
  const total = `${prefix}-total`;
  return (
    <>
      <FormField id={night} label="Night" hint={nightHint} error={errors.night}>
        <Input
          id={night}
          type="date"
          max={today}
          required
          className="h-11"
          value={values.night}
          disabled={disabled}
          aria-invalid={errors.night ? true : undefined}
          aria-describedby={describedBy(night, errors.night, Boolean(nightHint))}
          onChange={(event) => onChange("night", event.target.value)}
        />
      </FormField>
      <FormField id={total} label="How many came" hint="Everyone there, leaders included." error={errors.total}>
        <Input
          id={total}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          enterKeyHint="done"
          maxLength={6}
          required
          className="h-11"
          value={values.total}
          disabled={disabled}
          aria-invalid={errors.total ? true : undefined}
          aria-describedby={describedBy(total, errors.total, true)}
          onChange={(event) => onChange("total", event.target.value)}
        />
      </FormField>
    </>
  );
}

/** Focuses the first field with a problem, night before total. */
export function focusFirstError(prefix: string, errors: HeadcountErrors) {
  const first = errors.night ? "night" : errors.total ? "total" : null;
  if (first) document.getElementById(`${prefix}-${first}`)?.focus();
}

"use client";

import { describedBy, FormField } from "@/components/portal/form-field";
import { Checkbox } from "@/components/portal/ui/checkbox";
import { Input } from "@/components/portal/ui/input";
import { Label } from "@/components/portal/ui/label";
import type { IsoDate } from "@/lib/dates";
import { MAX_NOTE, type HeadcountErrors, type HeadcountValues } from "@/lib/portal/attendance/headcount";

export type HeadcountChange = <K extends keyof HeadcountValues>(field: K, value: HeadcountValues[K]) => void;

/**
 * A headcount's fields, for adding a night and for fixing one. Ids are
 * `${prefix}-night`, `${prefix}-total`, `${prefix}-note`, and
 * `${prefix}-combined`. The note and the mark span both columns of a grid.
 */
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
  onChange: HeadcountChange;
}) {
  const night = `${prefix}-night`;
  const total = `${prefix}-total`;
  const note = `${prefix}-note`;
  const combined = `${prefix}-combined`;
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
      <div className="space-y-4 sm:col-span-2">
        <FormField
          id={note}
          label="Note"
          optional
          hint="Anything different about the night, like a holiday."
          error={errors.note}
        >
          <Input
            id={note}
            autoComplete="off"
            enterKeyHint="done"
            maxLength={MAX_NOTE}
            className="h-11"
            value={values.note}
            disabled={disabled}
            aria-invalid={errors.note ? true : undefined}
            aria-describedby={describedBy(note, errors.note, true)}
            onChange={(event) => onChange("note", event.target.value)}
          />
        </FormField>
        <Label htmlFor={combined} className="min-h-11 cursor-pointer items-start gap-3 py-1 font-normal">
          <Checkbox
            id={combined}
            className="mt-0.5"
            checked={values.combined}
            disabled={disabled}
            aria-labelledby={`${combined}-title`}
            aria-describedby={`${combined}-hint`}
            onCheckedChange={(checked) => onChange("combined", checked === true)}
          />
          <span className="min-w-0 space-y-0.5 leading-snug">
            <span id={`${combined}-title`} className="block text-base font-medium desktop:text-sm">
              Combined event
            </span>
            <span id={`${combined}-hint`} className="block text-sm text-muted-foreground">
              Another group joined youth, so the average and the most leave this night out.
            </span>
          </span>
        </Label>
      </div>
    </>
  );
}

/** Focuses the first field with a problem, in the order they appear. */
export function focusFirstError(prefix: string, errors: HeadcountErrors) {
  const first = errors.night ? "night" : errors.total ? "total" : errors.note ? "note" : null;
  if (first) document.getElementById(`${prefix}-${first}`)?.focus();
}

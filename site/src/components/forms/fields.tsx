"use client";

import { Check, CircleAlert } from "lucide-react";
import Link from "next/link";
import { type ComponentProps, type ReactNode, useId, useState } from "react";
import { HONEYPOT_FIELD } from "@/lib/forms/guard";
import { limits } from "@/lib/forms/schemas";

/*
 * Form controls for the message forms: native inputs, styled. Text is at
 * least 16 px so iOS doesn't zoom in, and every tap target is 44 px.
 * A field with a problem points at its message with `aria-describedby`
 * and is marked with `aria-invalid`, or `data-invalid` on a choice, where
 * ARIA puts it on the group. `scroll-m-28` keeps a focused field clear of
 * the top bar.
 */

const labelClasses = "block text-[0.9375rem] font-semibold";

const inputClasses = [
  "mt-2 block w-full scroll-m-28 rounded-input bg-bg px-4 text-body text-fg ring-1 ring-line-strong outline-hidden ring-inset",
  "placeholder:text-muted/70 hover:ring-fg/30 focus:ring-2 focus:ring-accent-ink",
  "aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger",
].join(" ");

function Optional() {
  return <span className="font-normal text-muted"> (optional)</span>;
}

/**
 * A field's problem, in words and not just color. On phones the first one
 * takes the focus after a failed send, instead of its field, so a screen
 * reader reads it and the keyboard stays down.
 */
export function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} tabIndex={-1} data-field-error className="mt-2 flex gap-1.5 text-small font-medium text-danger outline-hidden">
      <CircleAlert aria-hidden className="mt-px size-4 shrink-0" />
      {children}
    </p>
  );
}

type FieldProps = {
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  className?: string;
};

function describedBy(...ids: (string | false | undefined)[]): string | undefined {
  return ids.filter(Boolean).join(" ") || undefined;
}

/**
 * A one-line text field. `invalid` and `aria-describedby` tie it to a
 * problem shown elsewhere, like the email-or-phone pair's.
 */
export function TextField({
  label,
  error,
  hint,
  optional,
  className,
  invalid,
  "aria-describedby": describedByOther,
  ...input
}: FieldProps & ComponentProps<"input"> & { invalid?: boolean }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClasses}>
        {label}
        {optional && <Optional />}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-small text-muted">
          {hint}
        </p>
      )}
      <input
        id={id}
        aria-invalid={error || invalid ? true : undefined}
        aria-describedby={describedBy(hint ? `${id}-hint` : undefined, error && `${id}-error`, describedByOther)}
        className={`${inputClasses} h-13`}
        {...input}
      />
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

/**
 * A multi-line field with a soft limit. It counts down near the limit and
 * turns red past it, instead of cutting off a paste.
 */
export function TextArea({
  label,
  error,
  hint,
  optional,
  className,
  limit,
  defaultValue,
  onChange,
  ...textarea
}: FieldProps & ComponentProps<"textarea"> & { limit: number; defaultValue?: string }) {
  const id = useId();
  const [length, setLength] = useState(defaultValue?.length ?? 0);
  const left = limit - length;

  return (
    <div className={className}>
      <label htmlFor={id} className={labelClasses}>
        {label}
        {optional && <Optional />}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-small text-muted">
          {hint}
        </p>
      )}
      <textarea
        id={id}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint ? `${id}-hint` : undefined, error && `${id}-error`)}
        onChange={(event) => {
          // Counted like the server counts it: trimmed, with one character per line break.
          setLength(event.currentTarget.value.trim().length);
          onChange?.(event);
        }}
        className={`${inputClasses} min-h-32 resize-y py-3.5 leading-normal`}
        {...textarea}
      />
      <div className="flex items-start justify-between gap-4">
        <FieldError id={`${id}-error`}>{error}</FieldError>
        {left < limit * 0.2 && (
          <p aria-hidden className={`mt-2 ml-auto text-small tabular-nums ${left < 0 ? "font-semibold text-danger" : "text-muted"}`}>
            {left < 0 ? `${-left} over` : `${left} left`}
          </p>
        )}
      </div>
    </div>
  );
}

type Choice = { value: string; label: string; body?: string };

type ChoiceGroupProps = {
  legend: string;
  name: string;
  choices: readonly Choice[];
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  className?: string;
};

/** A focus ring for a card or pill whose input is visually hidden inside it. */
const hiddenInputFocus = "has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-accent-ink";

function GroupShell({
  id,
  legend,
  hint,
  error,
  optional,
  className,
  children,
}: Omit<ChoiceGroupProps, "name" | "choices"> & { id: string; children: ReactNode }) {
  return (
    <fieldset className={className}>
      <legend className={labelClasses}>
        {legend}
        {optional && <Optional />}
      </legend>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-small text-muted">
          {hint}
        </p>
      )}
      {children}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </fieldset>
  );
}

/**
 * Pick one, as a grid of tiles: two across on phones, where a long label
 * wraps, and one row from `sm` up. The native radios stay in the page
 * for keyboards and screen readers. `onValueChange` hears each pick.
 */
export function ChoiceTiles({
  legend,
  name,
  choices,
  error,
  hint,
  optional,
  className,
  onValueChange,
}: ChoiceGroupProps & { onValueChange?: (value: string) => void }) {
  const id = useId();
  const columns = choices.length >= 4 ? "sm:grid-cols-4" : choices.length === 3 ? "sm:grid-cols-3" : "sm:max-w-md";

  return (
    <GroupShell id={id} legend={legend} hint={hint} error={error} optional={optional} className={className}>
      <div className={`mt-2.5 grid grid-cols-2 gap-2 ${columns}`}>
        {choices.map((choice) => (
          <label
            key={choice.value}
            className={`pressable relative flex min-h-14 cursor-pointer items-center justify-center rounded-input bg-bg px-3 py-2 text-center text-[0.9375rem] leading-tight font-semibold text-balance ring-inset select-none has-checked:bg-accent has-checked:text-on-accent has-checked:ring-0 ${hiddenInputFocus} ${
              error ? "ring-2 ring-danger" : "ring-1 ring-line-strong hover:ring-fg/30"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={choice.value}
              onChange={(event) => onValueChange?.(event.currentTarget.value)}
              data-invalid={error ? "" : undefined}
              aria-describedby={describedBy(hint ? `${id}-hint` : undefined, error && `${id}-error`)}
              className="sr-only scroll-m-28"
            />
            {choice.label}
          </label>
        ))}
      </div>
    </GroupShell>
  );
}

/**
 * Pick one (radio) or several (checkbox), as cards with a line of detail.
 * Pass `values` to control which are checked.
 */
export function ChoiceCards({
  legend,
  name,
  choices,
  error,
  hint,
  className,
  type = "radio",
  values,
  onValuesChange,
}: ChoiceGroupProps & {
  type?: "radio" | "checkbox";
  values?: string[];
  onValuesChange?: (values: string[]) => void;
}) {
  const id = useId();

  function toggle(value: string, checked: boolean) {
    if (!values || !onValuesChange) return;
    if (type === "radio") onValuesChange([value]);
    else onValuesChange(checked ? [...values, value] : values.filter((one) => one !== value));
  }

  return (
    <GroupShell id={id} legend={legend} hint={hint} error={error} className={className}>
      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
        {choices.map((choice) => (
          <label
            key={choice.value}
            className={`group pressable relative flex cursor-pointer items-start gap-3 rounded-tile bg-bg p-4 ring-inset select-none has-checked:bg-accent/10 has-checked:ring-2 has-checked:ring-accent-ink ${hiddenInputFocus} ${
              error ? "ring-2 ring-danger" : "ring-1 ring-line-strong hover:ring-fg/30"
            }`}
          >
            <input
              type={type}
              name={name}
              value={choice.value}
              checked={values === undefined ? undefined : values.includes(choice.value)}
              onChange={(event) => toggle(choice.value, event.currentTarget.checked)}
              data-invalid={error ? "" : undefined}
              aria-describedby={describedBy(hint ? `${id}-hint` : undefined, error && `${id}-error`)}
              className="sr-only scroll-m-28"
            />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{choice.label}</span>
              {choice.body && <span className="mt-0.5 block text-small text-pretty text-muted">{choice.body}</span>}
            </span>
            <span
              aria-hidden
              className={`mt-0.5 grid size-6 shrink-0 place-items-center text-on-accent ring-1 ring-line-strong ring-inset group-has-checked:bg-accent group-has-checked:ring-0 ${
                type === "radio" ? "rounded-full" : "rounded-md"
              }`}
            >
              <Check className="size-4 opacity-0 group-has-checked:opacity-100" strokeWidth={3} />
            </span>
          </label>
        ))}
      </div>
    </GroupShell>
  );
}

/**
 * A field people never see but form-filling bots do. It's moved off
 * screen rather than hidden, since some bots skip hidden fields.
 */
export function Honeypot() {
  return (
    <div aria-hidden className="absolute top-0 -left-[10000px] size-px overflow-hidden">
      <label>
        Leave this empty
        <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}

/**
 * An email or a phone, either one. Each field shows its own problem, and
 * both point at the pair's when neither is filled in.
 */
export function ReachFields({
  errors,
  legend = "How can a leader reach you?",
}: {
  errors: Partial<Record<"email" | "phone" | "reach", string>>;
  legend?: string;
}) {
  const id = useId();
  const reachId = `${id}-reach`;
  const shared = errors.reach ? reachId : undefined;

  return (
    <fieldset>
      <legend className={labelClasses}>{legend}</legend>
      <p className="mt-1 text-small text-muted">An email or a phone number. Either one works.</p>
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        <TextField
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={limits.email}
          error={errors.email}
          invalid={Boolean(errors.reach)}
          aria-describedby={shared}
          className="mt-3"
        />
        <TextField
          label="Phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          maxLength={limits.phone}
          error={errors.phone}
          invalid={Boolean(errors.reach)}
          aria-describedby={shared}
          className="sm:mt-3"
        />
      </div>
      <FieldError id={reachId}>{errors.reach}</FieldError>
    </fieldset>
  );
}

/** The line under a form's button: what the answers are for, and a link to the Privacy page. */
export function PrivacyNote({ children }: { children: ReactNode }) {
  return (
    <>
      {children}{" "}
      <Link href="/privacy" className="font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-accent-ink">
        Privacy
      </Link>
    </>
  );
}

/** High school or college, the Join form's optional question. */
export const studentBands = [
  { value: "hs", label: "High school" },
  { value: "college", label: "College" },
] as const;

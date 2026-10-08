"use client";

import { useRef, useState, type ChangeEvent, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { CircleAlertIcon, Trash2Icon } from "lucide-react";
import { describedBy, FormField } from "@/components/form-field";
import { DeleteConfirm } from "@/components/income/delete-confirm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ResponsiveSheetContent } from "@/components/ui/responsive-sheet";
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDate, todayInLA } from "@/lib/dates";
import {
  INCOME_METHOD_LABELS,
  INCOME_METHODS,
  incomeSaveErrorMessage,
  isAlreadySavedError,
  isIncomeDateError,
  MIXED,
  MIXED_LABEL,
  YOUTH_INCOME_KIND_LABELS,
  youthIncomeFieldErrors,
  youthIncomeSchema,
  type YouthIncomeField,
  type YouthIncomeFieldErrors,
  type YouthIncomeFormValues,
  type YouthIncomeKind,
} from "@/lib/income/schema";
import type { YouthEntry } from "@/lib/income/stats";
import { centsToDecimal, formatCents, parseAmountToCents } from "@/lib/money";
import { newLineId } from "@/lib/requests/lines";
import { MAX_REQUEST_CENTS, MIN_PURCHASE_DATE } from "@/lib/requests/schema";
import { createClient } from "@/lib/supabase/client";

const KINDS: YouthIncomeKind[] = ["tithe", "event"];

const FIELD_ORDER: YouthIncomeField[] = ["amount", "received_on", "kind", "event_name", "method"];

/** A radio button drawn as a card, like the request form's Cafe and Youth. */
const OPTION =
  "h-11 cursor-pointer rounded-lg border px-3 text-base font-normal has-[[aria-invalid=true]]:border-destructive has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-muted desktop:text-sm";

const fieldId = (key: YouthIncomeField) => `youth-income-${key}`;

/** Where focus goes for a field's error. A group focuses its first option. */
function focusId(key: YouthIncomeField): string {
  if (key === "kind") return `${fieldId("kind")}-${KINDS[0]}`;
  if (key === "method") return `${fieldId("method")}-${INCOME_METHODS[0]}`;
  return fieldId(key);
}

/** What an entry is called in a title, like "tithe" or "Bake sale". */
function entryName(entry: YouthEntry): string {
  return entry.kind === "tithe" ? "tithe" : (entry.event_name ?? "event");
}

/**
 * Add or edit a tithe or an event's total, in a bottom sheet on phones and
 * tablets and a dialog on PCs. Editing also offers Delete, behind a confirm.
 */
export function YouthIncomeSheet({ entry, onClose }: { entry: YouthEntry | "new" | null; onClose: () => void }) {
  const router = useRouter();
  const amountRef = useRef<HTMLInputElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Keep showing the last entry while the sheet animates closed.
  const [lastEntry, setLastEntry] = useState(entry);
  // Counts openings, so each one starts fresh even if the last is still animating closed.
  const [opening, setOpening] = useState(0);
  const [wasOpen, setWasOpen] = useState(false);
  if ((entry !== null) !== wasOpen) {
    setWasOpen(entry !== null);
    if (entry !== null) {
      setLastEntry(entry);
      setConfirmingDelete(false);
      setOpening((count) => count + 1);
    }
  }
  const current = entry ?? lastEntry;
  const existing = current === "new" ? null : current;

  function done() {
    onClose();
    router.refresh();
  }

  return (
    <Sheet open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveSheetContent
        key={opening}
        onOpenAutoFocus={(event) => {
          // Amount is the one thing to type, so it's ready on open.
          event.preventDefault();
          amountRef.current?.focus();
        }}
      >
        <SheetHeader className="pr-12">
          <SheetTitle>
            {!existing ? "Add youth income" : confirmingDelete ? `Delete this ${entryName(existing)}?` : `Edit ${entryName(existing)}`}
          </SheetTitle>
          <SheetDescription>
            {!existing
              ? "A tithe, or one total for an event like a bake sale."
              : confirmingDelete
                ? `${formatCents(existing.amount_cents)} on ${formatDate(existing.received_on)}. This can't be undone.`
                : "Fix the amount, the date, or how it came in."}
          </SheetDescription>
        </SheetHeader>
        {current && !confirmingDelete && (
          <YouthIncomeForm
            key={existing?.id ?? "new"}
            entry={existing}
            amountRef={amountRef}
            onSaved={done}
            onDelete={() => setConfirmingDelete(true)}
          />
        )}
        {existing && confirmingDelete && (
          <DeleteConfirm
            table="youth_income"
            id={existing.id}
            onBack={() => setConfirmingDelete(false)}
            onDeleted={done}
          />
        )}
      </ResponsiveSheetContent>
    </Sheet>
  );
}

function initialValues(entry: YouthEntry | null): YouthIncomeFormValues {
  if (!entry) return { kind: "tithe", amount: "", received_on: todayInLA(), method: "cash_app", event_name: "" };
  return {
    kind: entry.kind,
    amount: centsToDecimal(entry.amount_cents),
    received_on: entry.received_on,
    method: entry.method ?? MIXED,
    event_name: entry.event_name ?? "",
  };
}

function YouthIncomeForm({
  entry,
  amountRef,
  onSaved,
  onDelete,
}: {
  entry: YouthEntry | null;
  amountRef: RefObject<HTMLInputElement | null>;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const [values, setValues] = useState(() => initialValues(entry));
  // Picked once, so tapping Save again after a dropped connection can't add it twice.
  const [newId] = useState(newLineId);
  const [today] = useState(todayInLA);
  const [errors, setErrors] = useState<YouthIncomeFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function set<K extends YouthIncomeField>(key: K, value: YouthIncomeFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function inputProps(key: "amount" | "received_on" | "event_name", hint?: boolean) {
    const id = fieldId(key);
    return {
      id,
      value: values[key],
      "aria-invalid": errors[key] ? true : undefined,
      "aria-describedby": describedBy(id, errors[key], hint),
      onChange: (event: ChangeEvent<HTMLInputElement>) => set(key, event.target.value),
    };
  }

  function showFieldErrors(next: YouthIncomeFieldErrors) {
    setErrors(next);
    const first = FIELD_ORDER.find((key) => next[key]);
    if (first) document.getElementById(focusId(first))?.focus();
  }

  /** Tidies a valid amount, e.g. "$1,234.5" -> "1234.50". */
  function normalizeAmount() {
    const cents = parseAmountToCents(values.amount);
    if (cents !== null && cents <= MAX_REQUEST_CENTS) setValues((current) => ({ ...current, amount: centsToDecimal(cents) }));
  }

  async function save() {
    const parsed = youthIncomeSchema(today).safeParse(values);
    if (!parsed.success) {
      showFieldErrors(youthIncomeFieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setFormError(null);
    setPending(true);
    const table = createClient().from("youth_income");
    const { error } = entry
      ? await table.update(parsed.data).eq("id", entry.id).select("id").single()
      : await table.insert({ id: newId, ...parsed.data });

    if (error && !(entry === null && isAlreadySavedError(error))) {
      setPending(false);
      if (isIncomeDateError(error)) showFieldErrors({ received_on: incomeSaveErrorMessage(error) });
      else setFormError(incomeSaveErrorMessage(error));
      return;
    }
    // Stays pending while the sheet closes and the list reloads.
    onSaved();
  }

  const isEvent = values.kind === "event";
  const methods = isEvent ? ([...INCOME_METHODS, MIXED] as const) : INCOME_METHODS;
  const kindInvalid = errors.kind ? true : undefined;
  const methodInvalid = errors.method ? true : undefined;

  return (
    <form
      noValidate
      className="space-y-4 px-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {formError && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

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
              {...inputProps("amount")}
              ref={amountRef}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              onBlur={normalizeAmount}
              className="h-11 pl-6 tabular-nums"
            />
          </div>
        </FormField>
        <FormField id={fieldId("received_on")} label="Date given" error={errors.received_on}>
          <Input {...inputProps("received_on")} type="date" min={MIN_PURCHASE_DATE} max={today} className="h-11" />
        </FormField>
      </div>

      <FormField
        id={fieldId("kind")}
        label="What it was"
        hint={
          isEvent
            ? "One total for an event, like a bake sale. It can include tithes given there, and stays out of the tithe stats."
            : "One gift. Who gave is never recorded."
        }
        error={errors.kind}
        group
      >
        <RadioGroup
          value={values.kind}
          onValueChange={(value) => set("kind", value as YouthIncomeKind)}
          aria-labelledby={`${fieldId("kind")}-label`}
          aria-describedby={describedBy(fieldId("kind"), errors.kind, true)}
          aria-invalid={kindInvalid}
          className="grid-cols-2 gap-3"
        >
          {KINDS.map((kind) => (
            <Label key={kind} htmlFor={`${fieldId("kind")}-${kind}`} className={OPTION}>
              <RadioGroupItem id={`${fieldId("kind")}-${kind}`} value={kind} aria-invalid={kindInvalid} />
              {YOUTH_INCOME_KIND_LABELS[kind]}
            </Label>
          ))}
        </RadioGroup>
      </FormField>

      {isEvent && (
        <FormField
          id={fieldId("event_name")}
          label="Event name"
          optional
          hint="Like Bake sale. Leave out who gave."
          error={errors.event_name}
        >
          <Input {...inputProps("event_name", true)} autoComplete="off" maxLength={100} className="h-11" />
        </FormField>
      )}

      <FormField
        id={fieldId("method")}
        label="How it came in"
        hint={isEvent ? "Mixed is for money that came in more than one way." : undefined}
        error={errors.method}
        group
      >
        <RadioGroup
          value={values.method}
          onValueChange={(value) => set("method", value as YouthIncomeFormValues["method"])}
          aria-labelledby={`${fieldId("method")}-label`}
          aria-describedby={describedBy(fieldId("method"), errors.method, isEvent)}
          aria-invalid={methodInvalid}
          className="grid-cols-2 gap-3"
        >
          {methods.map((method) => (
            <Label key={method} htmlFor={`${fieldId("method")}-${method}`} className={OPTION}>
              <RadioGroupItem id={`${fieldId("method")}-${method}`} value={method} aria-invalid={methodInvalid} />
              {method === MIXED ? MIXED_LABEL : INCOME_METHOD_LABELS[method]}
            </Label>
          ))}
        </RadioGroup>
      </FormField>

      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Saving…" : entry ? "Save changes" : "Add"}
      </Button>

      {entry && (
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={pending}
          onClick={onDelete}
        >
          <Trash2Icon aria-hidden />
          Delete
        </Button>
      )}
    </form>
  );
}

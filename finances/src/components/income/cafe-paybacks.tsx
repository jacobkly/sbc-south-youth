"use client";

import { useRef, useState, type ChangeEvent, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, CircleAlertIcon, Trash2Icon } from "lucide-react";
import { StepButton } from "@/components/income/cafe-week-sheet";
import { DeleteConfirm } from "@/components/income/delete-confirm";
import { describedBy, FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveSheetContent } from "@/components/ui/responsive-sheet";
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, periodContaining, periodLabel, periodRange, shiftPeriod, type IsoDate } from "@/lib/dates";
import { quarterStartOf, stillOwed, type CafePayback, type DiscountQuarter } from "@/lib/income/cafe";
import {
  cafePaybackFieldErrors,
  cafePaybackSchema,
  incomeSaveErrorMessage,
  isAlreadySavedError,
  isIncomeDateError,
  type CafePaybackField,
  type CafePaybackFieldErrors,
  type CafePaybackFormValues,
} from "@/lib/income/schema";
import { centsToDecimal, formatCents, parseAmountToCents } from "@/lib/money";
import { newLineId } from "@/lib/requests/lines";
import { MAX_REQUEST_CENTS, MIN_PURCHASE_DATE } from "@/lib/requests/schema";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** "Q3 2026" for the quarter starting on `start`. */
function quarterName(start: IsoDate): string {
  return periodLabel(periodContaining("quarter", start));
}

/** The first day of the quarter `steps` away. */
function shiftQuarter(start: IsoDate, steps: number): IsoDate {
  return periodRange(shiftPeriod(periodContaining("quarter", start), steps)).start;
}

/**
 * What the church owes for cafe discounts, quarter by quarter. Owners record
 * a payback here and tap one to fix it. Left out until there's a discount or
 * a payback.
 */
export function CafePaybacks({
  quarters,
  today,
  onRecord,
  onOpen,
}: {
  /** From `discountQuarters`, newest first. */
  quarters: DiscountQuarter[];
  /** This quarter's discounts are only so far. */
  today: IsoDate;
  /** Starts a new payback. Left out for viewers. */
  onRecord?: () => void;
  /** Opens a payback to edit. Left out for viewers. */
  onOpen?: (payback: CafePayback) => void;
}) {
  if (quarters.length === 0) return null;
  const owed = stillOwed(quarters);
  const total = owed.reduce((sum, quarter) => sum + quarter.left, 0);
  const thisQuarter = quarterStartOf(today);

  return (
    <section aria-labelledby="cafe-paybacks-heading" className="space-y-2">
      <h2 id="cafe-paybacks-heading" className="text-sm font-medium text-muted-foreground">
        Church paybacks
      </h2>
      <div className="overflow-hidden rounded-lg border">
        <div className="space-y-3 px-4 py-3">
          {owed.length > 0 ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium">Church still owes</p>
                <p className="font-semibold tabular-nums">{formatCents(total)}</p>
              </div>
              <ul className="space-y-1 text-sm">
                {owed.map((quarter) => (
                  <li key={quarter.start} className="flex items-baseline justify-between gap-3">
                    <span>
                      {quarterName(quarter.start)}
                      {quarter.start === thisQuarter && <span className="text-muted-foreground"> so far</span>}
                    </span>
                    <span className="tabular-nums">
                      {formatCents(quarter.left)}
                      {quarter.paid > 0 && (
                        <span className="text-muted-foreground"> of {formatCents(quarter.owed)}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="space-y-0.5">
              <p className="font-medium">All paid back</p>
              <p className="text-sm text-muted-foreground">
                The church has paid back every quarter&apos;s discounts.
              </p>
            </div>
          )}
          {onRecord && (
            <Button
              variant={owed.length > 0 ? "default" : "outline"}
              className="h-11 w-full desktop:w-auto desktop:px-5"
              onClick={onRecord}
            >
              Record church payback
            </Button>
          )}
        </div>

        <details className="group border-t">
          <summary className="cursor-pointer list-none outline-none hover:bg-muted focus-visible:bg-muted [&::-webkit-details-marker]:hidden">
            <span className="flex min-h-11 items-center justify-between gap-2 px-4 py-2 text-sm font-medium">
              Paybacks by quarter
              <ChevronDownIcon className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
            </span>
          </summary>
          <ul className="divide-y border-t">
            {quarters.map((quarter) => (
              <li key={quarter.start}>
                <QuarterRow quarter={quarter} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </details>
      </div>
    </section>
  );
}

function QuarterRow({ quarter, onOpen }: { quarter: DiscountQuarter; onOpen?: (payback: CafePayback) => void }) {
  return (
    <div className="space-y-1 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium">{quarterName(quarter.start)}</p>
        {quarter.left === 0 ? (
          <Badge variant="secondary">Paid</Badge>
        ) : (
          <span className="text-sm tabular-nums">{formatCents(quarter.left)} left</span>
        )}
      </div>
      <p className="text-sm text-muted-foreground tabular-nums">
        Discounts {formatCents(quarter.owed)} · Paid back {formatCents(quarter.paid)}
      </p>
      {quarter.paybacks.length > 0 && (
        <ul className="-mx-2 pt-1">
          {quarter.paybacks.map((payback) => (
            <li key={payback.id}>
              <PaybackRow payback={payback} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PaybackRow({ payback, onOpen }: { payback: CafePayback; onOpen?: (payback: CafePayback) => void }) {
  const content = (
    <>
      <span className="min-w-0 flex-1 truncate">
        {[`Received ${formatDate(payback.received_on)}`, payback.note].filter(Boolean).join(" · ")}
      </span>
      <span className="shrink-0 tabular-nums">{formatCents(payback.amount_cents)}</span>
    </>
  );
  const row = "flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left text-sm";

  if (!onOpen) return <div className={row}>{content}</div>;
  return (
    <button
      type="button"
      className={cn(row, "outline-none hover:bg-muted focus-visible:bg-muted")}
      onClick={() => onOpen(payback)}
    >
      {content}
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

type PaybackField = Exclude<CafePaybackField, "quarter_start">;

const fieldId = (key: PaybackField | "quarter") => `cafe-payback-${key}`;

const FIELD_ORDER: PaybackField[] = ["amount", "received_on", "note"];

/**
 * Record or fix a payback from the church for a quarter's cafe discounts, in
 * a bottom sheet on phones and tablets and a dialog on PCs. A new one opens
 * on the oldest quarter still owed, with what's left of it and today's date.
 */
export function CafePaybackSheet({
  payback,
  quarters,
  today,
  onClose,
}: {
  /** The payback to edit, "new" to record one, or null when closed. */
  payback: CafePayback | "new" | null;
  quarters: DiscountQuarter[];
  today: IsoDate;
  onClose: () => void;
}) {
  const router = useRouter();
  const amountRef = useRef<HTMLInputElement>(null);
  const open = payback !== null;
  // Stays as it was while the sheet animates closed.
  const [shown, setShown] = useState<CafePayback | "new">(payback ?? "new");
  // Picked per opening, so tapping Save again after a dropped connection can't add it twice.
  const [newId, setNewId] = useState(newLineId);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Counts openings, so each one starts fresh even if the last is still animating closed.
  const [opening, setOpening] = useState(0);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setShown(payback);
      setNewId(newLineId());
      setConfirmingDelete(false);
      setOpening((count) => count + 1);
    }
  }
  const existing = shown === "new" ? null : shown;

  function done() {
    onClose();
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <ResponsiveSheetContent
        key={opening}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          amountRef.current?.focus();
        }}
      >
        <SheetHeader className="pr-12">
          <SheetTitle>
            {!existing ? "Record church payback" : confirmingDelete ? "Delete this payback?" : "Edit church payback"}
          </SheetTitle>
          <SheetDescription>
            {!existing
              ? "Money from the church for a quarter's cafe discounts."
              : confirmingDelete
                ? `${formatCents(existing.amount_cents)} for ${quarterName(existing.quarter_start)}, received ${formatDate(existing.received_on)}. This can't be undone.`
                : "Fix the quarter, date, amount, or note."}
          </SheetDescription>
        </SheetHeader>
        {existing && confirmingDelete ? (
          <DeleteConfirm
            table="cafe_paybacks"
            id={existing.id}
            onBack={() => setConfirmingDelete(false)}
            onDeleted={done}
          />
        ) : (
          <CafePaybackForm
            existing={existing}
            quarters={quarters}
            newId={newId}
            today={today}
            amountRef={amountRef}
            onSaved={done}
            onDelete={() => setConfirmingDelete(true)}
          />
        )}
      </ResponsiveSheetContent>
    </Sheet>
  );
}

function initialValues(existing: CafePayback | null, quarters: DiscountQuarter[], today: IsoDate): CafePaybackFormValues {
  if (existing) {
    return {
      quarter_start: existing.quarter_start,
      received_on: existing.received_on,
      amount: centsToDecimal(existing.amount_cents),
      note: existing.note ?? "",
    };
  }
  const oldest = stillOwed(quarters)[0];
  return {
    quarter_start: oldest?.start ?? quarterStartOf(today),
    received_on: today,
    amount: oldest ? centsToDecimal(oldest.left) : "",
    note: "",
  };
}

function CafePaybackForm({
  existing,
  quarters,
  newId,
  today,
  amountRef,
  onSaved,
  onDelete,
}: {
  existing: CafePayback | null;
  quarters: DiscountQuarter[];
  newId: string;
  today: IsoDate;
  amountRef: RefObject<HTMLInputElement | null>;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const [values, setValues] = useState(() => initialValues(existing, quarters, today));
  // A new payback's amount follows the quarter until it's typed.
  const [amountTyped, setAmountTyped] = useState(existing !== null);
  const [errors, setErrors] = useState<CafePaybackFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function pickQuarter(start: IsoDate) {
    const left = quarters.find((quarter) => quarter.start === start)?.left ?? 0;
    setValues((current) => ({
      ...current,
      quarter_start: start,
      amount: amountTyped ? current.amount : left > 0 ? centsToDecimal(left) : "",
    }));
    if (!amountTyped) setErrors((current) => ({ ...current, amount: undefined }));
    setFormError(null);
  }

  function inputProps(key: PaybackField, hint?: boolean) {
    const id = fieldId(key);
    return {
      id,
      value: values[key],
      "aria-invalid": errors[key] ? true : undefined,
      "aria-describedby": describedBy(id, errors[key], hint),
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setValues((current) => ({ ...current, [key]: event.target.value }));
        setErrors((current) => ({ ...current, [key]: undefined }));
        if (key === "amount") setAmountTyped(true);
      },
    };
  }

  /** Tidies a valid amount, e.g. "$1,234.5" -> "1234.50". */
  function normalizeAmount() {
    const cents = parseAmountToCents(values.amount);
    if (cents !== null && cents <= MAX_REQUEST_CENTS) {
      setValues((current) => ({ ...current, amount: centsToDecimal(cents) }));
    }
  }

  async function save() {
    const parsed = cafePaybackSchema(today).safeParse(values);
    if (!parsed.success) {
      const next = cafePaybackFieldErrors(parsed.error);
      setErrors(next);
      // The quarter comes from the arrows, so its message goes at the top.
      setFormError(next.quarter_start ?? null);
      const first = FIELD_ORDER.find((key) => next[key]);
      if (first) document.getElementById(fieldId(first))?.focus();
      return;
    }

    setErrors({});
    setFormError(null);
    setPending(true);
    const table = createClient().from("cafe_paybacks");
    const { error } = existing
      ? await table.update(parsed.data).eq("id", existing.id).select("id").single()
      : await table.insert({ id: newId, ...parsed.data });

    if (error && !(existing === null && isAlreadySavedError(error))) {
      setPending(false);
      if (isIncomeDateError(error)) {
        setErrors({ received_on: incomeSaveErrorMessage(error) });
        document.getElementById(fieldId("received_on"))?.focus();
      } else {
        setFormError(incomeSaveErrorMessage(error));
      }
      return;
    }
    // Stays pending while the sheet closes and the list reloads.
    onSaved();
  }

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

      <QuarterPicker
        start={values.quarter_start}
        quarter={quarters.find((quarter) => quarter.start === values.quarter_start)}
        today={today}
        onPick={pickQuarter}
      />

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
        <FormField id={fieldId("received_on")} label="Date received" error={errors.received_on}>
          <Input {...inputProps("received_on")} type="date" min={MIN_PURCHASE_DATE} max={today} className="h-11" />
        </FormField>
      </div>

      <FormField id={fieldId("note")} label="Note" optional hint="Like By check." error={errors.note}>
        <Textarea {...inputProps("note", true)} maxLength={500} rows={2} />
      </FormField>

      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Saving…" : existing ? "Save changes" : "Record payback"}
      </Button>

      {existing && (
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

/** Steps a quarter at a time, back to 2000 and up to this quarter. */
function QuarterPicker({
  start,
  quarter,
  today,
  onPick,
}: {
  start: IsoDate;
  /** Its discounts and paybacks, if it has any. */
  quarter: DiscountQuarter | undefined;
  today: IsoDate;
  onPick: (start: IsoDate) => void;
}) {
  const id = fieldId("quarter");
  const detail = !quarter
    ? "No discounts"
    : quarter.left === 0
      ? `Discounts ${formatCents(quarter.owed)} · Paid back`
      : `Discounts ${formatCents(quarter.owed)} · ${formatCents(quarter.left)} left`;
  return (
    <FormField id={id} label="Quarter" group>
      <div role="group" aria-labelledby={`${id}-label`} className="flex items-center gap-2">
        <StepButton
          label="Quarter before"
          disabled={start <= MIN_PURCHASE_DATE}
          onClick={() => onPick(shiftQuarter(start, -1))}
        >
          <ChevronLeftIcon />
        </StepButton>
        <div
          aria-live="polite"
          className="flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-lg border px-3 py-1 text-center"
        >
          <p className="truncate font-medium">{quarterName(start)}</p>
          <p className="truncate text-xs text-muted-foreground tabular-nums">{detail}</p>
        </div>
        <StepButton
          label="Quarter after"
          disabled={start >= quarterStartOf(today)}
          onClick={() => onPick(shiftQuarter(start, 1))}
        >
          <ChevronRightIcon />
        </StepButton>
      </div>
    </FormField>
  );
}

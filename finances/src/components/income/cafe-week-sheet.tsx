"use client";

import { useRef, useState, type ChangeEvent, type ReactNode, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, CircleAlertIcon, Trash2Icon } from "lucide-react";
import { DeleteConfirm } from "@/components/income/delete-confirm";
import { describedBy, FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveSheetContent } from "@/components/ui/responsive-sheet";
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { addDays, type IsoDate } from "@/lib/dates";
import { moneyFromSquare, NO_LINES, type CafeLines, type CafeWeek } from "@/lib/income/cafe";
import {
  cafeWeekFieldErrors,
  cafeWeekSchema,
  incomeSaveErrorMessage,
  isAlreadySavedError,
  parseSalesToCents,
  type CafeWeekFieldErrors,
  type CafeWeekFormValues,
} from "@/lib/income/schema";
import { FIRST_WEEK_ENDING, latestWeekEnding, relativeWeekLabel, weekLabel } from "@/lib/income/weeks";
import { centsToDecimal, formatCents } from "@/lib/money";
import { newLineId } from "@/lib/requests/lines";
import { MAX_REQUEST_CENTS } from "@/lib/requests/schema";
import { createClient } from "@/lib/supabase/client";

type CafeField = Exclude<keyof CafeWeekFormValues, "week_ending">;

type LineField = Exclude<CafeField, "note">;

const fieldId = (key: CafeField | "week") => `cafe-week-${key}`;

/** Each line as Square's sales summary names it, and the column it saves to. */
const LINES: Record<LineField, { label: string; hint?: string; column: keyof CafeLines }> = {
  sales: { label: "Gross sales", hint: "Enter 0 if the cafe was closed.", column: "sales_cents" },
  discounts: { label: "Discounts & comps", hint: "The church pays them back.", column: "discounts_cents" },
  tips: { label: "Tips", column: "tips_cents" },
  fees: { label: "Fees", column: "fees_cents" },
  returns: { label: "Returns", column: "returns_cents" },
  gift_card_sales: { label: "Gift card sales", column: "gift_card_sales_cents" },
  gift_card_redeemed: { label: "Gift card redeemed", column: "gift_card_redeemed_cents" },
  taxes: { label: "Taxes", column: "taxes_cents" },
};

const MAIN_LINES = ["sales", "discounts", "tips", "fees"] as const satisfies readonly LineField[];

/** Lines most weeks don't have, folded away until one does. */
const MORE_LINES = ["returns", "gift_card_sales", "gift_card_redeemed", "taxes"] as const satisfies readonly LineField[];

const FIELD_ORDER = [...MAIN_LINES, ...MORE_LINES, "note"] as const;

/**
 * Enter or fix one week's cafe sales, in a bottom sheet on phones and tablets
 * and a dialog on PCs. The arrows step through weeks, and a week that already
 * has its sales opens to edit, with Delete behind a confirm.
 */
export function CafeWeekSheet({
  weekEnding,
  weeks,
  today,
  onClose,
}: {
  /** The week to open on, or null when closed. */
  weekEnding: IsoDate | null;
  weeks: readonly CafeWeek[];
  today: IsoDate;
  onClose: () => void;
}) {
  const router = useRouter();
  const salesRef = useRef<HTMLInputElement>(null);
  const open = weekEnding !== null;
  const [week, setWeek] = useState(weekEnding ?? today);
  // Picked per week, so tapping Save again after a dropped connection can't add it twice.
  const [newId, setNewId] = useState(newLineId);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Counts openings, so each one starts fresh even if the last is still animating closed.
  const [opening, setOpening] = useState(0);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setWeek(weekEnding);
      setNewId(newLineId());
      setConfirmingDelete(false);
      setOpening((count) => count + 1);
    }
  }
  // The weeks stay as they were while the sheet animates closed, so a new week doesn't turn into an edit on the way out.
  const [shownWeeks, setShownWeeks] = useState(weeks);
  if (open && weeks !== shownWeeks) setShownWeeks(weeks);
  const existing = shownWeeks.find((entry) => entry.week_ending === week) ?? null;

  function pickWeek(next: IsoDate) {
    setWeek(next);
    setNewId(newLineId());
  }

  function done() {
    onClose();
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <ResponsiveSheetContent
        key={opening}
        onOpenAutoFocus={(event) => {
          // Sales are the one thing to type, so they're ready on open.
          event.preventDefault();
          salesRef.current?.focus();
        }}
      >
        <SheetHeader className="pr-12">
          <SheetTitle>
            {!existing ? "Add cafe week" : confirmingDelete ? "Delete this week's sales?" : "Edit cafe week"}
          </SheetTitle>
          <SheetDescription>
            {!existing
              ? "One week's lines from Square's sales summary, Monday to Sunday."
              : confirmingDelete
                ? `${formatCents(existing.sales_cents)} for ${weekLabel(existing.week_ending, today)}. This can't be undone.`
                : "Fix the lines or the note."}
          </SheetDescription>
        </SheetHeader>
        {existing && confirmingDelete ? (
          <DeleteConfirm
            table="cafe_weeks"
            id={existing.id}
            onBack={() => setConfirmingDelete(false)}
            onDeleted={done}
          />
        ) : (
          <div className="space-y-4 px-4">
            <WeekPicker week={week} today={today} entered={existing !== null} onPick={pickWeek} />
            <CafeWeekForm
              key={existing?.id ?? "new"}
              week={week}
              existing={existing}
              newId={newId}
              today={today}
              salesRef={salesRef}
              onSaved={done}
              onDelete={() => setConfirmingDelete(true)}
            />
          </div>
        )}
      </ResponsiveSheetContent>
    </Sheet>
  );
}

/** Steps a week at a time, back to 2000 and up to this week. */
export function WeekPicker({
  id = fieldId("week"),
  week,
  today,
  entered,
  error,
  onPick,
}: {
  id?: string;
  week: IsoDate;
  today: IsoDate;
  entered: boolean;
  error?: string;
  onPick: (week: IsoDate) => void;
}) {
  const detail = [relativeWeekLabel(week, today), entered && "Already entered"].filter(Boolean).join(" · ");
  return (
    <FormField id={id} label="Week" group error={error}>
      <div role="group" aria-labelledby={`${id}-label`} className="flex items-center gap-2">
        <StepButton label="Week before" disabled={week <= FIRST_WEEK_ENDING} onClick={() => onPick(addDays(week, -7))}>
          <ChevronLeftIcon />
        </StepButton>
        <div
          aria-live="polite"
          className="flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-lg border px-3 py-1 text-center"
        >
          <p className="truncate font-medium">{weekLabel(week, today)}</p>
          <p className="truncate text-xs text-muted-foreground">{detail || "Monday to Sunday"}</p>
        </div>
        <StepButton
          label="Week after"
          disabled={week >= latestWeekEnding(today)}
          onClick={() => onPick(addDays(week, 7))}
        >
          <ChevronRightIcon />
        </StepButton>
      </div>
    </FormField>
  );
}

/** Marked aria-disabled rather than disabled, so focus stays on it at the first or last step. */
export function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className="size-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      onClick={() => !disabled && onClick()}
    >
      {children}
    </Button>
  );
}

/** A line's typed amount as cents, with blank or anything not yet an amount as $0. */
function typedCents(value: string): number {
  return parseSalesToCents(value) ?? 0;
}

function initialValues(existing: CafeWeek | null): Record<CafeField, string> {
  const values = { note: existing?.note ?? "" } as Record<CafeField, string>;
  for (const key of [...MAIN_LINES, ...MORE_LINES]) {
    const cents = existing?.[LINES[key].column] ?? 0;
    // Gross is always typed, even as 0. The other lines can stay blank.
    values[key] = existing && (cents || key === "sales") ? centsToDecimal(cents) : "";
  }
  return values;
}

function CafeWeekForm({
  week,
  existing,
  newId,
  today,
  salesRef,
  onSaved,
  onDelete,
}: {
  week: IsoDate;
  existing: CafeWeek | null;
  newId: string;
  today: IsoDate;
  salesRef: RefObject<HTMLInputElement | null>;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const [values, setValues] = useState(() => initialValues(existing));
  const [errors, setErrors] = useState<CafeWeekFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showMore, setShowMore] = useState(() => MORE_LINES.some((key) => values[key] !== ""));

  const lines = { ...NO_LINES };
  for (const key of [...MAIN_LINES, ...MORE_LINES]) lines[LINES[key].column] = typedCents(values[key]);

  function inputProps(key: CafeField, hint?: boolean) {
    const id = fieldId(key);
    return {
      id,
      value: values[key],
      "aria-invalid": errors[key] ? true : undefined,
      "aria-describedby": describedBy(id, errors[key], hint),
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setValues((current) => ({ ...current, [key]: event.target.value }));
        setErrors((current) => ({ ...current, [key]: undefined }));
      },
    };
  }

  /** Tidies a valid amount, e.g. "$1,234.5" -> "1234.50" and "0" -> "0.00". */
  function normalize(key: LineField) {
    const cents = parseSalesToCents(values[key]);
    if (cents !== null && cents <= MAX_REQUEST_CENTS) setValues((current) => ({ ...current, [key]: centsToDecimal(cents) }));
  }

  async function save() {
    const parsed = cafeWeekSchema(today).safeParse({ week_ending: week, ...values });
    if (!parsed.success) {
      const next = cafeWeekFieldErrors(parsed.error);
      setErrors(next);
      // The week comes from the arrows, so its message goes at the top.
      setFormError(next.week_ending ?? null);
      if (MORE_LINES.some((key) => next[key])) setShowMore(true);
      const first = FIELD_ORDER.find((key) => next[key]);
      // Waits a frame, so a field under More lines is on screen first.
      if (first) requestAnimationFrame(() => document.getElementById(fieldId(first))?.focus());
      return;
    }

    setErrors({});
    setFormError(null);
    setPending(true);
    const table = createClient().from("cafe_weeks");
    // An edit is always for the week it opened on, so its week_ending doesn't change.
    const { error } = existing
      ? await table.update(parsed.data).eq("id", existing.id).select("id").single()
      : await table.insert({ id: newId, ...parsed.data });

    if (error && !(existing === null && isAlreadySavedError(error))) {
      setPending(false);
      setFormError(incomeSaveErrorMessage(error));
      return;
    }
    // Stays pending while the sheet closes and the list reloads.
    onSaved();
  }

  function lineField(key: LineField) {
    const { label, hint } = LINES[key];
    return (
      <FormField key={key} id={fieldId(key)} label={label} hint={hint} error={errors[key]}>
        <div className="relative">
          <span
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          >
            $
          </span>
          <Input
            {...inputProps(key, Boolean(hint))}
            ref={key === "sales" ? salesRef : undefined}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            onBlur={() => normalize(key)}
            className="h-11 pl-6 tabular-nums"
          />
        </div>
      </FormField>
    );
  }

  return (
    <form
      noValidate
      className="space-y-4"
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

      <div className="grid grid-cols-2 gap-x-3 gap-y-4">{MAIN_LINES.map(lineField)}</div>

      <div className="space-y-4">
        <Button
          type="button"
          variant="ghost"
          aria-expanded={showMore}
          aria-controls="cafe-week-more"
          className="-mx-2 h-11 px-2 text-muted-foreground"
          onClick={() => setShowMore((current) => !current)}
        >
          More lines
          <ChevronDownIcon className={showMore ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden />
        </Button>
        <div id="cafe-week-more" hidden={!showMore} className="grid grid-cols-2 gap-x-3 gap-y-4">
          {MORE_LINES.map(lineField)}
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-3 rounded-lg bg-muted px-3 py-2.5 text-sm">
        <span className="text-muted-foreground">Money from Square</span>
        <span aria-live="polite" className="font-semibold tabular-nums">
          {formatCents(moneyFromSquare(lines))}
        </span>
      </div>

      <FormField id={fieldId("note")} label="Note" optional hint="Like Closed for camp." error={errors.note}>
        <Textarea {...inputProps("note", true)} maxLength={500} rows={2} />
      </FormField>

      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Saving…" : existing ? "Save changes" : "Add"}
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

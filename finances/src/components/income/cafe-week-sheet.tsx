"use client";

import { useRef, useState, type ChangeEvent, type ReactNode, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon, CircleAlertIcon, Trash2Icon } from "lucide-react";
import { DeleteConfirm } from "@/components/income/delete-confirm";
import { describedBy, FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveSheetContent } from "@/components/ui/responsive-sheet";
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { addDays, type IsoDate } from "@/lib/dates";
import type { CafeWeek } from "@/lib/income/cafe";
import {
  cafeWeekFieldErrors,
  cafeWeekSchema,
  incomeSaveErrorMessage,
  isAlreadySavedError,
  parseSalesToCents,
  type CafeWeekFieldErrors,
} from "@/lib/income/schema";
import { FIRST_WEEK_ENDING, latestWeekEnding, relativeWeekLabel, weekLabel } from "@/lib/income/weeks";
import { centsToDecimal, formatCents } from "@/lib/money";
import { newLineId } from "@/lib/requests/lines";
import { MAX_REQUEST_CENTS } from "@/lib/requests/schema";
import { createClient } from "@/lib/supabase/client";

type CafeField = "sales" | "note";

const fieldId = (key: CafeField | "week") => `cafe-week-${key}`;

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
              ? "The cafe's sales for one week, Monday to Sunday."
              : confirmingDelete
                ? `${formatCents(existing.sales_cents)} for ${weekLabel(existing.week_ending, today)}. This can't be undone.`
                : "Fix the sales or the note."}
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

function WeekPicker({
  week,
  today,
  entered,
  onPick,
}: {
  week: IsoDate;
  today: IsoDate;
  entered: boolean;
  onPick: (week: IsoDate) => void;
}) {
  const detail = [relativeWeekLabel(week, today), entered && "Already entered"].filter(Boolean).join(" · ");
  return (
    <FormField id={fieldId("week")} label="Week" group>
      <div role="group" aria-labelledby={`${fieldId("week")}-label`} className="flex items-center gap-2">
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

/** Marked aria-disabled rather than disabled, so focus stays on it at the first or last week. */
function StepButton({
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
  const [values, setValues] = useState<Record<CafeField, string>>(() => ({
    sales: existing ? centsToDecimal(existing.sales_cents) : "",
    note: existing?.note ?? "",
  }));
  const [errors, setErrors] = useState<CafeWeekFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

  /** Tidies valid sales, e.g. "$1,234.5" -> "1234.50" and "0" -> "0.00". */
  function normalizeSales() {
    const cents = parseSalesToCents(values.sales);
    if (cents !== null && cents <= MAX_REQUEST_CENTS) setValues((current) => ({ ...current, sales: centsToDecimal(cents) }));
  }

  async function save() {
    const parsed = cafeWeekSchema(today).safeParse({ week_ending: week, ...values });
    if (!parsed.success) {
      const next = cafeWeekFieldErrors(parsed.error);
      setErrors(next);
      // The week comes from the arrows, so its message goes at the top.
      setFormError(next.week_ending ?? null);
      const first = (["sales", "note"] as const).find((key) => next[key]);
      if (first) document.getElementById(fieldId(first))?.focus();
      return;
    }

    setErrors({});
    setFormError(null);
    setPending(true);
    const table = createClient().from("cafe_weeks");
    const { sales_cents, note } = parsed.data;
    const { error } = existing
      ? await table.update({ sales_cents, note }).eq("id", existing.id).select("id").single()
      : await table.insert({ id: newId, ...parsed.data });

    if (error && !(existing === null && isAlreadySavedError(error))) {
      setPending(false);
      setFormError(incomeSaveErrorMessage(error));
      return;
    }
    // Stays pending while the sheet closes and the list reloads.
    onSaved();
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

      <FormField id={fieldId("sales")} label="Sales" hint="Enter 0 if the cafe was closed." error={errors.sales}>
        <div className="relative">
          <span
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          >
            $
          </span>
          <Input
            {...inputProps("sales", true)}
            ref={salesRef}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            onBlur={normalizeSales}
            className="h-11 pl-6 tabular-nums"
          />
        </div>
      </FormField>

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

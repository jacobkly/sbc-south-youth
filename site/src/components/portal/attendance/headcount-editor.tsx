"use client";

import { useState } from "react";
import { LoaderCircleIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/portal/ui/alert";
import { Button } from "@/components/portal/ui/button";
import { Separator } from "@/components/portal/ui/separator";
import { SheetClose, SheetDescription, SheetHeader, SheetTitle } from "@/components/portal/ui/sheet";
import { formatWeekdayDate, type IsoDate } from "@/lib/dates";
import { removeHeadcount, saveHeadcount, type RemoveResult, type SaveResult } from "@/lib/portal/attendance/actions";
import {
  checkHeadcount,
  type Headcount,
  type HeadcountErrors,
  type HeadcountValues,
} from "@/lib/portal/attendance/headcount";
import { focusFirstError, HeadcountFields } from "./headcount-fields";

const PREFIX = "headcount-edit";
const OFFLINE = "Couldn't reach the portal. Check your connection and try again.";

/**
 * One night's count, opened from the list: its night and total to fix, and
 * a second step to remove it. Closing waits for a save or removal that's
 * halfway through.
 */
export function HeadcountEditor({
  count,
  today,
  readOnly,
  busy,
  setBusy,
  onDone,
}: {
  count: Headcount;
  today: IsoDate;
  readOnly: boolean;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onDone: (message: string) => void;
}) {
  const [step, setStep] = useState<"edit" | "remove">("edit");
  const [values, setValues] = useState<HeadcountValues>({ night: count.night, total: String(count.total) });
  const [errors, setErrors] = useState<HeadcountErrors>({});
  const [error, setError] = useState<string | null>(null);
  const night = formatWeekdayDate(count.night, today);
  const changed = values.night !== count.night || values.total.trim().replace(/,/g, "") !== String(count.total);

  function change(field: keyof HeadcountValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setError(null);
  }

  function showErrors(found: HeadcountErrors) {
    setErrors(found);
    focusFirstError(PREFIX, found);
  }

  async function save() {
    setError(null);
    const check = checkHeadcount(values, today);
    if (!check.ok) {
      showErrors(check.errors);
      return;
    }
    setBusy(true);
    let result: SaveResult;
    try {
      result = await saveHeadcount(count.id, values);
    } catch {
      result = { status: "failed", message: OFFLINE };
    } finally {
      setBusy(false);
    }
    if (result.status === "invalid") showErrors(result.errors);
    else if (result.status === "failed") setError(result.message);
    else onDone(result.message);
  }

  async function remove() {
    setError(null);
    setBusy(true);
    let result: RemoveResult;
    try {
      result = await removeHeadcount(count.id);
    } catch {
      result = { status: "failed", message: OFFLINE };
    } finally {
      setBusy(false);
    }
    if (result.status === "failed") setError(result.message);
    else onDone(result.message);
  }

  const failure = error && (
    <Alert variant="destructive">
      <TriangleAlertIcon />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );

  if (step === "remove") {
    return (
      <>
        <SheetHeader className="pr-12">
          <SheetTitle>Remove the count for {night}?</SheetTitle>
          <SheetDescription>
            Its {count.total} comes off the list and out of the numbers at the top. Use this for a night entered by
            mistake.
          </SheetDescription>
        </SheetHeader>
        {failure && <div className="px-4">{failure}</div>}
        <div className="flex flex-col-reverse gap-2 px-4 pt-2 desktop:flex-row desktop:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-11 px-5"
            disabled={busy}
            onClick={() => {
              setError(null);
              setStep("edit");
            }}
          >
            Back
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-11 px-5"
            disabled={readOnly || busy}
            onClick={() => void remove()}
          >
            {busy && <LoaderCircleIcon className="animate-spin" aria-hidden />}
            {busy ? "Removing…" : error ? "Try again" : "Remove"}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <SheetHeader className="pr-12">
        <SheetTitle>{night}</SheetTitle>
        <SheetDescription>Fix the night or how many came.</SheetDescription>
      </SheetHeader>

      <form
        className="space-y-4 px-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <HeadcountFields
          prefix={PREFIX}
          values={values}
          errors={errors}
          today={today}
          disabled={readOnly}
          onChange={change}
        />

        {failure}

        <div className="flex flex-col-reverse gap-2 pt-2 desktop:flex-row desktop:justify-end">
          <SheetClose asChild>
            <Button type="button" variant="outline" className="h-11 px-5" disabled={busy}>
              Cancel
            </Button>
          </SheetClose>
          <Button type="submit" className="h-11 px-5" disabled={readOnly || busy || !changed}>
            {busy && <LoaderCircleIcon className="animate-spin" aria-hidden />}
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>

      <div className="space-y-3 px-4">
        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="min-w-0 flex-1 basis-56 text-sm text-muted-foreground">Entered by mistake? Take it off.</p>
          <Button
            type="button"
            variant="outline"
            className="h-11 px-4 text-destructive hover:text-destructive"
            disabled={readOnly || busy}
            onClick={() => {
              setError(null);
              setStep("remove");
            }}
          >
            <Trash2Icon aria-hidden />
            Remove…
          </Button>
        </div>
      </div>
    </>
  );
}

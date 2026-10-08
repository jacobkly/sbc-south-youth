"use client";

import { useState, useTransition } from "react";
import { CircleCheckIcon, LoaderCircleIcon } from "lucide-react";
import { Button } from "@/components/portal/ui/button";
import type { IsoDate } from "@/lib/dates";
import { saveHeadcount, type SaveResult } from "@/lib/portal/attendance/actions";
import {
  checkHeadcount,
  countedHint,
  suggestedNight,
  type Headcount,
  type HeadcountErrors,
  type HeadcountValues,
} from "@/lib/portal/attendance/headcount";
import { focusFirstError, HeadcountFields } from "./headcount-fields";

const PREFIX = "headcount";
const OFFLINE = "Couldn't reach the portal. Check your connection and try again.";

/**
 * Adds a night's count. It starts on the latest Friday without one and moves
 * to the next after each save, so catching up on missed weeks is one count
 * after another.
 */
export function HeadcountForm({
  counts,
  today,
  readOnly,
}: {
  counts: Headcount[];
  /** Today in Los Angeles, worked out on the server. */
  today: IsoDate;
  readOnly: boolean;
}) {
  const [values, setValues] = useState<HeadcountValues>(() => ({
    night: suggestedNight(
      today,
      counts.map(({ night }) => night),
    ),
    total: "",
  }));
  const [errors, setErrors] = useState<HeadcountErrors>({});
  const [message, setMessage] = useState<{ kind: "saved" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const counted = countedHint(values.night, counts, today);

  function change(field: keyof HeadcountValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setMessage(null);
  }

  function showErrors(found: HeadcountErrors) {
    setErrors(found);
    focusFirstError(PREFIX, found);
  }

  function submit() {
    setMessage(null);
    const check = checkHeadcount(values, today);
    const found: HeadcountErrors = check.ok ? {} : { ...check.errors };
    // A night has one count, so a second is a fix to the first.
    if (!found.night && counted) found.night = counted;
    if (found.night || found.total) {
      showErrors(found);
      return;
    }

    startTransition(async () => {
      let result: SaveResult;
      try {
        result = await saveHeadcount(null, values);
      } catch {
        result = { status: "failed", message: OFFLINE };
      }
      if (result.status === "invalid") {
        showErrors(result.errors);
        return;
      }
      if (result.status === "failed") {
        setMessage({ kind: "error", text: result.message });
        return;
      }
      const saved = values.night.trim();
      setValues({ night: suggestedNight(today, [...counts.map(({ night }) => night), saved]), total: "" });
      setMessage({ kind: "saved", text: result.message });
      // Ready for the next night's number.
      document.getElementById(`${PREFIX}-total`)?.focus();
    });
  }

  return (
    <section aria-labelledby="add-heading" className="space-y-4 rounded-xl border bg-card p-4">
      <h2 id="add-heading" className="font-semibold">
        Add a night
      </h2>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <HeadcountFields
            prefix={PREFIX}
            values={values}
            errors={errors}
            nightHint={counted ?? undefined}
            today={today}
            disabled={readOnly}
            onChange={change}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" className="h-11 w-full px-6 sm:w-auto" disabled={readOnly || pending}>
            {pending && <LoaderCircleIcon className="animate-spin" aria-hidden />}
            {pending ? "Saving…" : "Save count"}
          </Button>
          {message?.kind === "error" && (
            <p role="alert" className="text-sm text-destructive">
              {message.text}
            </p>
          )}
          {message?.kind === "saved" && (
            <p role="status" className="flex items-start gap-2 text-sm text-muted-foreground">
              <CircleCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              {message.text}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}

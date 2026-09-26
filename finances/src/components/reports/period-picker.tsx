"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import { FormField, describedBy } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  formatDate,
  periodLabel,
  periodRange,
  shiftPeriod,
  type CalendarPeriod,
  type IsoDate,
  type Period,
  type PeriodKind,
} from "@/lib/dates";
import { canStepForward, customPeriod, switchPeriodKind, type CustomPeriod } from "@/lib/reports/filters";

const KINDS: readonly PeriodKind[] = ["month", "quarter", "year", "custom"];

const KIND_LABELS: Record<PeriodKind, string> = {
  month: "Month",
  quarter: "Quarter",
  year: "Year",
  custom: "Custom",
};

const SELECTED = "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground hover:data-[state=on]:bg-primary/90";

/** Wait this long after a date changes, so typing a year doesn't load a report per digit. */
const CUSTOM_DELAY_MS = 500;

/** Pick a month, quarter, or year and step through them, or pick any date range. */
export function PeriodPicker({
  period,
  today,
  onChange,
}: {
  period: Period;
  today: IsoDate;
  onChange: (period: Period) => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        // The stepper fits beside the kinds when there's room. The custom fields have labels, so they go below.
        period.kind !== "custom" && "@xl:flex-row @xl:items-center @xl:gap-4",
      )}
    >
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={0}
        value={period.kind}
        onValueChange={(kind) => kind && onChange(switchPeriodKind(period, kind as PeriodKind, today))}
        aria-label="Period"
        className="w-full @xl:w-auto @xl:self-start"
      >
        {KINDS.map((kind) => (
          <ToggleGroupItem key={kind} value={kind} className={`h-11 flex-1 px-2 @xl:flex-none @xl:px-4 ${SELECTED}`}>
            {KIND_LABELS[kind]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {period.kind === "custom" ? (
        <CustomRange period={period} onChange={onChange} />
      ) : (
        <PeriodStepper period={period} today={today} onChange={onChange} />
      )}
    </div>
  );
}

function PeriodStepper({
  period,
  today,
  onChange,
}: {
  period: CalendarPeriod;
  today: IsoDate;
  onChange: (period: Period) => void;
}) {
  const { start, end } = periodRange(period);
  const kind = KIND_LABELS[period.kind].toLowerCase();
  return (
    <div className="flex items-center gap-2 @xl:flex-1">
      <Button
        variant="outline"
        size="icon"
        className="size-11"
        aria-label={`Previous ${kind}`}
        onClick={() => onChange(shiftPeriod(period, -1))}
      >
        <ChevronLeftIcon />
      </Button>
      <div aria-live="polite" className="min-w-0 flex-1 text-center">
        <p className="font-semibold">{periodLabel(period)}</p>
        {period.kind !== "year" && (
          <p className="text-sm text-muted-foreground tabular-nums">
            {formatDate(start)} – {formatDate(end)}
          </p>
        )}
      </div>
      <Button
        variant="outline"
        size="icon"
        className="size-11"
        aria-label={`Next ${kind}`}
        disabled={!canStepForward(period, today)}
        onClick={() => onChange(shiftPeriod(period, 1))}
      >
        <ChevronRightIcon />
      </Button>
    </div>
  );
}

/** Two date fields. The report follows once both are filled in and in order. */
function CustomRange({ period, onChange }: { period: CustomPeriod; onChange: (period: Period) => void }) {
  const [draft, setDraft] = useState({ start: period.start, end: period.end });
  const [loaded, setLoaded] = useState(period);

  // The range can change without typing, like going back. Show it in the
  // fields, unless the user has typed something newer.
  if (period.start !== loaded.start || period.end !== loaded.end) {
    setLoaded(period);
    if (draft.start === loaded.start && draft.end === loaded.end) setDraft({ start: period.start, end: period.end });
  }

  const outOfOrder = Boolean(draft.start && draft.end && draft.start > draft.end);
  const rangeError = outOfOrder ? "The start date is after the end date." : undefined;

  const commit = useEffectEvent((next: { start: string; end: string }) => {
    const range = customPeriod(next.start, next.end);
    if (range && (range.start !== period.start || range.end !== period.end)) onChange(range);
  });

  useEffect(() => {
    const timer = setTimeout(() => commit(draft), CUSTOM_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <FormField id="report-from" label="From">
          <Input
            id="report-from"
            type="date"
            value={draft.start}
            onChange={(event) => setDraft({ ...draft, start: event.target.value })}
            className="h-11"
          />
        </FormField>
        <FormField id="report-to" label="To">
          <Input
            id="report-to"
            type="date"
            value={draft.end}
            onChange={(event) => setDraft({ ...draft, end: event.target.value })}
            aria-invalid={outOfOrder}
            aria-describedby={describedBy("report-range", rangeError)}
            className="h-11"
          />
        </FormField>
      </div>
      {rangeError && (
        <p id="report-range-error" className="text-sm text-destructive">
          {rangeError}
        </p>
      )}
    </div>
  );
}

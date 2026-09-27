"use client";

import { useState } from "react";
import { SlidersHorizontalIcon, XIcon } from "lucide-react";
import { describedBy, FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveSheetContent } from "@/components/ui/responsive-sheet";
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { Tables } from "@/lib/database.types";
import { formatDate } from "@/lib/dates";
import { REQUEST_TYPE_LABELS } from "@/lib/requests/format";
import { activeFilterCount, type QueueFilters } from "@/lib/requests/queue";
import { REQUEST_TYPES, type RequestType } from "@/lib/requests/schema";

export type PayeeOption = Pick<Tables<"payees">, "id" | "full_name" | "is_active">;

/** The filters set in the sheet. The tab and search are set on the page. */
export type SheetFilters = Pick<QueueFilters, "from" | "to" | "type" | "payee" | "missingReceipt">;

const CLEARED: SheetFilters = { from: null, to: null, type: null, payee: null, missingReceipt: false };

// Radix Select and RadioGroup need a non-empty value for "no filter".
const ANY = "any";

const FILTERS_BUTTON_ID = "request-filters-button";

function sheetFilters({ from, to, type, payee, missingReceipt }: QueueFilters): SheetFilters {
  return { from, to, type, payee, missingReceipt };
}

/**
 * The Filters button and its sheet. Changes are kept in the sheet until
 * "Show results", so the list doesn't reload on every tap.
 */
export function FilterSheet({
  filters,
  payees,
  onApply,
}: {
  filters: QueueFilters;
  payees: PayeeOption[];
  onApply: (changes: SheetFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SheetFilters>(() => sheetFilters(filters));
  const count = activeFilterCount(filters);
  const rangeError =
    draft.from && draft.to && draft.from > draft.to ? "The start date is after the end date." : undefined;

  function change(changes: Partial<SheetFilters>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rangeError) return;
    onApply(draft);
    setOpen(false);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        // Start from what's applied, not from changes that were closed without applying.
        if (next) setDraft(sheetFilters(filters));
        setOpen(next);
      }}
    >
      <Button
        id={FILTERS_BUTTON_ID}
        type="button"
        variant="outline"
        className="h-11 shrink-0 px-3"
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontalIcon aria-hidden />
        Filters
        {count > 0 && (
          <Badge className="min-w-5 px-1.5 tabular-nums">
            {count}
            <span className="sr-only"> on</span>
          </Badge>
        )}
      </Button>

      <ResponsiveSheetContent>
        <SheetHeader className="pr-12">
          <SheetTitle>Filter requests</SheetTitle>
          <SheetDescription>Applies to every tab.</SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} noValidate className="space-y-5 px-4">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Purchase date</legend>
            <div className="grid grid-cols-2 gap-3">
              <FormField id="filter-from" label="From">
                <Input
                  id="filter-from"
                  type="date"
                  value={draft.from ?? ""}
                  onChange={(event) => change({ from: event.target.value || null })}
                  className="h-11"
                />
              </FormField>
              <FormField id="filter-to" label="To">
                <Input
                  id="filter-to"
                  type="date"
                  value={draft.to ?? ""}
                  onChange={(event) => change({ to: event.target.value || null })}
                  aria-invalid={Boolean(rangeError)}
                  aria-describedby={describedBy("filter-date", rangeError)}
                  className="h-11"
                />
              </FormField>
            </div>
            {rangeError && (
              <p id="filter-date-error" className="text-sm text-destructive">
                {rangeError}
              </p>
            )}
          </fieldset>

          <FormField id="filter-type" label="Type" group>
            <RadioGroup
              value={draft.type ?? ANY}
              onValueChange={(value) => change({ type: value === ANY ? null : (value as RequestType) })}
              aria-labelledby="filter-type-label"
              className="grid-cols-3 gap-3"
            >
              {[ANY, ...REQUEST_TYPES].map((value) => (
                <Label
                  key={value}
                  htmlFor={`filter-type-${value}`}
                  className="h-11 cursor-pointer rounded-lg border px-3 text-base font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-muted desktop:text-sm"
                >
                  <RadioGroupItem id={`filter-type-${value}`} value={value} />
                  {value === ANY ? "Any" : REQUEST_TYPE_LABELS[value as RequestType]}
                </Label>
              ))}
            </RadioGroup>
          </FormField>

          <FormField id="filter-payee" label="Payee">
            <Select
              value={draft.payee ?? ANY}
              onValueChange={(value) => change({ payee: value === ANY ? null : value })}
            >
              <SelectTrigger id="filter-payee" className="w-full text-base data-[size=default]:h-11 desktop:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any payee</SelectItem>
                {payees.map((payee) => (
                  <SelectItem key={payee.id} value={payee.id}>
                    {payee.full_name}
                    {!payee.is_active && <span className="text-muted-foreground">(inactive)</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2">
            <Label htmlFor="filter-missing-receipt" className="text-base font-normal desktop:text-sm">
              Only requests missing a receipt
            </Label>
            <Switch
              id="filter-missing-receipt"
              checked={draft.missingReceipt}
              onCheckedChange={(on) => change({ missingReceipt: on })}
            />
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 desktop:flex-row desktop:justify-end">
            <Button type="button" variant="outline" className="h-11 desktop:min-w-28" onClick={() => setDraft(CLEARED)}>
              Clear all
            </Button>
            <Button type="submit" className="h-11 desktop:min-w-28">
              Show results
            </Button>
          </div>
        </form>
      </ResponsiveSheetContent>
    </Sheet>
  );
}

function dateRangeLabel(from: string | null, to: string | null): string | null {
  if (from && to) return `${formatDate(from)} – ${formatDate(to)}`;
  if (from) return `Since ${formatDate(from)}`;
  if (to) return `Through ${formatDate(to)}`;
  return null;
}

/** The filters that are on, as chips that each turn one off. */
export function ActiveFilters({
  filters,
  payees,
  onRemove,
}: {
  filters: QueueFilters;
  payees: PayeeOption[];
  onRemove: (changes: Partial<SheetFilters>) => void;
}) {
  const chips: { key: string; label: string; clear: Partial<SheetFilters> }[] = [];
  const dates = dateRangeLabel(filters.from, filters.to);
  if (dates) chips.push({ key: "dates", label: dates, clear: { from: null, to: null } });
  if (filters.type) chips.push({ key: "type", label: REQUEST_TYPE_LABELS[filters.type], clear: { type: null } });
  if (filters.payee) {
    const name = payees.find((option) => option.id === filters.payee)?.full_name ?? "Unknown payee";
    chips.push({ key: "payee", label: name, clear: { payee: null } });
  }
  if (filters.missingReceipt) {
    chips.push({ key: "missingReceipt", label: "Missing a receipt", clear: { missingReceipt: false } });
  }

  if (chips.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Filters on">
      {chips.map((chip) => (
        <li key={chip.key} className="max-w-full">
          <Button
            type="button"
            variant="secondary"
            className="h-9 max-w-full rounded-full pr-2 pl-3 font-normal"
            aria-label={`Remove filter: ${chip.label}`}
            onClick={(event) => {
              // The chip is about to go, so keep focus nearby instead of losing it to the page.
              const item = event.currentTarget.closest("li");
              const neighbor = (item?.nextElementSibling ?? item?.previousElementSibling)?.querySelector("button");
              (neighbor ?? document.getElementById(FILTERS_BUTTON_ID))?.focus();
              onRemove(chip.clear);
            }}
          >
            <span className="truncate">{chip.label}</span>
            <XIcon aria-hidden />
          </Button>
        </li>
      ))}
    </ul>
  );
}

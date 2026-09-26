"use client";

import { useState } from "react";
import { ArrowLeftIcon, CheckIcon, ChevronsUpDownIcon, PlusIcon, SearchIcon } from "lucide-react";
import { PayeeForm } from "@/components/payees/payee-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveSheetContent } from "@/components/ui/responsive-sheet";
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { PayeeRow } from "@/lib/payees/columns";
import { payeeMatches, payeeSearchNeedle } from "@/lib/payees/search";

/**
 * Picks the payee for a request. Opens a sheet with search and an inline
 * "Add new payee" form, so a new person never means leaving the request.
 */
export function PayeePicker({
  id,
  labelId,
  payees,
  value,
  onChange,
  onAdded,
  invalid,
  describedBy,
}: {
  id: string;
  /** The field label's id. The button reads as the label plus the chosen payee. */
  labelId: string;
  /** Active payees, sorted by name. */
  payees: PayeeRow[];
  value: string;
  onChange: (payeeId: string) => void;
  onAdded: (payee: PayeeRow) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");

  const selected = payees.find((payee) => payee.id === value) ?? null;
  const needle = payeeSearchNeedle(query);
  const visible = payees.filter((payee) => payeeMatches(payee, needle));

  function openPicker() {
    setAdding(false);
    setQuery("");
    setOpen(true);
  }

  function choose(payeeId: string) {
    onChange(payeeId);
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        id={id}
        variant="outline"
        className="h-11 w-full justify-between px-3 text-base font-normal md:text-sm"
        aria-haspopup="dialog"
        aria-labelledby={`${labelId} ${id}`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={openPicker}
      >
        {selected ? (
          <span className="truncate">{selected.full_name}</span>
        ) : (
          <span className="text-muted-foreground">Choose a payee</span>
        )}
        <ChevronsUpDownIcon className="text-muted-foreground" aria-hidden />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <ResponsiveSheetContent className="gap-0 overflow-hidden touch:h-[min(85dvh,calc(var(--visible-height,100dvh)-1rem))] touch:pb-[env(safe-area-inset-bottom)] desktop:h-[70dvh] desktop:pb-0">
          {adding ? (
            <div className="min-h-0 flex-1 overflow-y-auto pb-4">
              <SheetHeader>
                <Button
                  type="button"
                  variant="ghost"
                  className="-ml-2 h-10 w-fit"
                  onClick={() => setAdding(false)}
                >
                  <ArrowLeftIcon />
                  Back to payees
                </Button>
                <SheetTitle>Add payee</SheetTitle>
                <SheetDescription>They&rsquo;ll be chosen for this request once saved.</SheetDescription>
              </SheetHeader>
              <PayeeForm
                payee={null}
                defaultName={query.trim()}
                onSaved={(payee) => {
                  onAdded(payee);
                  choose(payee.id);
                }}
              />
            </div>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle>Choose payee</SheetTitle>
                <SheetDescription className="sr-only">Search for the person to reimburse.</SheetDescription>
              </SheetHeader>
              <div className="space-y-2 px-4 pb-3">
                <div className="relative">
                  <SearchIcon
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    type="search"
                    aria-label="Search payees"
                    placeholder="Search name, email, or handle"
                    autoComplete="off"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="h-11 pl-9"
                  />
                </div>
                {/* Kept above the list so it stays visible over the iOS keyboard. */}
                <Button type="button" variant="outline" className="h-11 w-full justify-start" onClick={() => setAdding(true)}>
                  <PlusIcon />
                  <span className="truncate">
                    {needle ? <>Add &ldquo;{query.trim()}&rdquo; as a new payee</> : "Add new payee"}
                  </span>
                </Button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                {visible.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                    {needle ? <>No active payees match &ldquo;{query.trim()}&rdquo;.</> : "No payees yet."}
                  </p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {visible.map((payee) => {
                      const isSelected = payee.id === value;
                      const details = [payee.payment_handle, payee.email].filter(Boolean).join(" · ");
                      return (
                        <li key={payee.id}>
                          <button
                            type="button"
                            aria-pressed={isSelected}
                            className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left outline-none hover:bg-muted focus-visible:bg-muted"
                            onClick={() => choose(payee.id)}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{payee.full_name}</p>
                              {details && <p className="truncate text-sm text-muted-foreground">{details}</p>}
                            </div>
                            {isSelected && <CheckIcon className="size-4 shrink-0 text-primary" aria-hidden />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </ResponsiveSheetContent>
      </Sheet>
    </>
  );
}

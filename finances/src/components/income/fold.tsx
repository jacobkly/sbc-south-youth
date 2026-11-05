"use client";

import { useState, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type FoldProps = {
  title: string;
  /** How much is in it, beside the title. */
  note: string;
  /** What it came to, on the right. */
  total: ReactNode;
  /** The money behind the total. */
  detail: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

const SUMMARY =
  "cursor-pointer list-none outline-none hover:bg-muted focus-visible:bg-muted [&::-webkit-details-marker]:hidden";

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronDownIcon
      className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
      aria-hidden
    />
  );
}

/**
 * A year as a plain line of text with its total, which opens to its months.
 * The money behind the total shows once it's open. Its contents render only
 * then, so years of tithes stay light on a phone.
 */
export function YearFold({ title, note, total, detail, defaultOpen = false, children }: FoldProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className={cn(SUMMARY, "rounded-md")}>
        <span className="flex min-h-12 items-center justify-between gap-3 px-1">
          <span className="min-w-0">
            <span className="text-lg font-semibold">{title}</span>{" "}
            <span className="ml-1 text-xs whitespace-nowrap text-muted-foreground tabular-nums">{note}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-sm tabular-nums">
            {total}
            <Chevron open={open} />
          </span>
        </span>
      </summary>
      {open && (
        <div className="space-y-2 pb-4">
          <p className="px-1 text-xs text-muted-foreground tabular-nums">{detail}</p>
          {children}
        </div>
      )}
    </details>
  );
}

/**
 * A month as a card, which opens to show what's in it inside the same card.
 * Its contents render only once it's open.
 */
export function MonthFold({ title, note, total, detail, defaultOpen = false, children }: FoldProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="overflow-hidden rounded-lg border"
    >
      <summary className={SUMMARY}>
        <span className="block min-h-11 space-y-0.5 px-4 py-3">
          <span className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="font-medium">{title}</span>{" "}
              <span className="ml-1 text-xs whitespace-nowrap text-muted-foreground tabular-nums">{note}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2 text-sm tabular-nums">
              {total}
              <Chevron open={open} />
            </span>
          </span>
          <span className="block text-xs text-muted-foreground tabular-nums">{detail}</span>
        </span>
      </summary>
      {open && <div className="border-t">{children}</div>}
    </details>
  );
}

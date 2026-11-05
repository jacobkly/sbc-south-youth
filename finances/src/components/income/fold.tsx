"use client";

import { useState, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A month or past year folded into one row, which opens to show what's in it.
 * Its contents render only once it's open, so years of tithes stay light on a
 * phone.
 */
export function Fold({
  title,
  note,
  total,
  detail,
  children,
}: {
  title: string;
  /** How much is in it, beside the title. */
  note: string;
  /** What it came to, on the right. */
  total: ReactNode;
  /** The money behind the total, on a line under it. */
  detail: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer list-none rounded-lg border outline-none hover:bg-muted focus-visible:bg-muted [&::-webkit-details-marker]:hidden">
        <span className="block min-h-11 space-y-0.5 px-4 py-3">
          <span className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="font-medium">{title}</span>{" "}
              <span className="ml-1 text-xs whitespace-nowrap text-muted-foreground tabular-nums">{note}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2 text-sm tabular-nums">
              {total}
              <ChevronDownIcon
                className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
                aria-hidden
              />
            </span>
          </span>
          <span className="block text-xs text-muted-foreground tabular-nums">{detail}</span>
        </span>
      </summary>
      {open && <div className="space-y-2 pt-2">{children}</div>}
    </details>
  );
}

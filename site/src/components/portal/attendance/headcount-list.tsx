"use client";

import { useRef, useState } from "react";
import { ChevronRightIcon, CircleCheckIcon } from "lucide-react";
import { Badge } from "@/components/portal/ui/badge";
import { ResponsiveSheetContent } from "@/components/portal/ui/responsive-sheet";
import { Sheet } from "@/components/portal/ui/sheet";
import { formatWeekdayDate, type IsoDate } from "@/lib/dates";
import type { Headcount } from "@/lib/portal/attendance/headcount";
import { HeadcountEditor } from "./headcount-editor";

const ROW =
  "flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left outline-none hover:bg-muted/50 " +
  "focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset";

function Night({ count, today }: { count: Headcount; today: IsoDate }) {
  return (
    <>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{formatWeekdayDate(count.night, today)}</span>
          {count.combined && <Badge variant="secondary">Combined event</Badge>}
        </span>
        {count.note && <span className="block text-sm break-words text-muted-foreground">{count.note}</span>}
      </span>
      <span className="text-lg font-semibold tabular-nums">
        {count.total}
        <span className="sr-only"> came</span>
      </span>
    </>
  );
}

/**
 * Every night's count, newest first. Someone with Attendance taps a night to
 * fix or remove it. Finance viewers only read.
 */
export function HeadcountList({
  counts,
  today,
  canEdit,
  readOnly,
}: {
  counts: Headcount[];
  today: IsoDate;
  canEdit: boolean;
  readOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Kept once the sheet closes, so it doesn't empty while it slides away.
  const [target, setTarget] = useState<Headcount | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const finished = useRef(false);

  function block(event: Event) {
    if (busy) event.preventDefault();
  }

  return (
    <section aria-labelledby="nights-heading" className="space-y-3">
      <div className="space-y-1">
        <h2 id="nights-heading" className="flex items-baseline gap-2 text-lg font-semibold">
          Every night
          <span className="text-sm font-normal text-muted-foreground">{counts.length}</span>
        </h2>
        <p className="text-sm text-muted-foreground">
          {canEdit ? "Newest first. Tap a night to fix it." : "Newest first."}
        </p>
      </div>

      {done && (
        <p
          role="status"
          ref={status}
          tabIndex={-1}
          className="flex items-start gap-2 text-sm text-muted-foreground outline-none"
        >
          <CircleCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="min-w-0">{done}</span>
        </p>
      )}

      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {counts.map((count) => (
          <li key={count.id}>
            {canEdit ? (
              <button
                type="button"
                className={ROW}
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  setDone(null);
                  setTarget(count);
                  setOpen(true);
                }}
              >
                <Night count={count} today={today} />
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            ) : (
              <div className="flex min-w-0 items-center gap-3 px-4 py-3">
                <Night count={count} today={today} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <Sheet open={open} onOpenChange={(next) => (next || !busy) && setOpen(next)}>
          <ResponsiveSheetContent
            onInteractOutside={block}
            onEscapeKeyDown={block}
            onCloseAutoFocus={(event) => {
              // Back to the night on cancel; after a save or removal, to the message saying so.
              event.preventDefault();
              (finished.current ? status.current : opener.current)?.focus();
              finished.current = false;
            }}
          >
            {target && (
              <HeadcountEditor
                key={target.id}
                count={target}
                today={today}
                readOnly={readOnly}
                busy={busy}
                setBusy={setBusy}
                onDone={(message) => {
                  finished.current = true;
                  setDone(message);
                  setOpen(false);
                }}
              />
            )}
          </ResponsiveSheetContent>
        </Sheet>
      )}
    </section>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlertIcon, FileUpIcon } from "lucide-react";
import { WeekPicker } from "@/components/income/cafe-week-sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ResponsiveSheetContent } from "@/components/ui/responsive-sheet";
import { Sheet, SheetClose, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { IsoDate } from "@/lib/dates";
import { moneyFromSquare, type CafeLines, type CafeWeek } from "@/lib/income/cafe";
import {
  byImportOrder,
  cafeImportWrites,
  planCafeImport,
  type CafeImportFile,
  type CafeImportRow,
} from "@/lib/income/cafe-import";
import { incomeSaveErrorMessage } from "@/lib/income/schema";
import { parseSalesSummaries, type ParsedSalesSummary } from "@/lib/income/square";
import { defaultWeekEnding, weekLabel } from "@/lib/income/weeks";
import { formatCents } from "@/lib/money";
import { newLineId } from "@/lib/requests/lines";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// A year of weeks, with room to spare.
const MAX_FILES = 60;

// A sales summary by day is about 180 bytes a day, so this holds over ten years.
const MAX_FILE_BYTES = 1_000_000;

async function readFile(file: File): Promise<CafeImportFile[]> {
  const entry = (parsed: ParsedSalesSummary): CafeImportFile => ({ key: newLineId(), name: file.name, parsed, picked: null });
  if (!/\.csv$/i.test(file.name)) {
    return [entry({ ok: false, error: "Export the sales summary from Square as a CSV file." })];
  }
  if (file.size > MAX_FILE_BYTES) {
    return [entry({ ok: false, error: "This file is too big for Square's sales summary." })];
  }
  try {
    return parseSalesSummaries(await file.text(), file.name).map(entry);
  } catch {
    return [entry({ ok: false, error: "Couldn't read this file. Try choosing it again." })];
  }
}

function weekCount(count: number): string {
  return `${count} ${count === 1 ? "week" : "weeks"}`;
}

/**
 * Imports weeks from Square's sales summary: a CSV file per week, or one file
 * by day that holds many weeks. Choosing files opens a preview of each week.
 * New weeks go in, and a week already entered is replaced only when its switch
 * is on.
 */
export function CafeImportButton({
  weeks,
  today,
  className,
  variant = "outline",
  label = "Import",
}: {
  weeks: readonly CafeWeek[];
  today: IsoDate;
  className?: string;
  variant?: "default" | "outline";
  label?: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<CafeImportFile[] | null>(null);
  const [tooMany, setTooMany] = useState(false);
  const [replace, setReplace] = useState<ReadonlySet<IsoDate>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const rows = files ? planCafeImport(files, weeks, today) : [];
  const { inserts, updates } = cafeImportWrites(rows, replace);
  const saving = inserts.length + updates.length;
  const saved = new Map(weeks.map((week) => [week.week_ending, week]));

  async function choose(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    setReplace(new Set());
    setTooMany(list.length > MAX_FILES);
    if (list.length > MAX_FILES) {
      setFiles([]);
      return;
    }
    const read = await Promise.all([...list].map(readFile));
    setFiles(read.flat().sort(byImportOrder));
  }

  function pick(key: string, week: IsoDate) {
    setFiles((current) => current?.map((file) => (file.key === key ? { ...file, picked: week } : file)) ?? null);
  }

  function toggleReplace(week: IsoDate, on: boolean) {
    setReplace((current) => {
      const next = new Set(current);
      if (on) next.add(week);
      else next.delete(week);
      return next;
    });
  }

  async function runImport() {
    setPending(true);
    setError(null);
    const table = createClient().from("cafe_weeks");
    const results = await Promise.all([
      inserts.length ? table.insert(inserts) : null,
      ...updates.map(({ id, ...lines }) => table.update(lines).eq("id", id).select("id").single()),
    ]);
    setPending(false);

    const failed = results.find((result) => result?.error)?.error;
    if (failed) {
      // Some weeks may have gone in, so the list reloads to show what's saved now.
      setError(`Not everything was imported. ${incomeSaveErrorMessage(failed)}`);
      setReplace(new Set());
      router.refresh();
      return;
    }
    setFiles(null);
    router.refresh();
  }

  const counts = {
    new: rows.filter((row) => row.status === "new").length,
    existing: rows.filter((row) => row.status === "existing").length,
    waiting: rows.filter((row) => row.status === "needs_week").length,
    left: rows.filter((row) => row.status === "error").length,
  };
  const summary = [
    counts.new && `${counts.new} new`,
    counts.existing && `${counts.existing} already entered`,
    counts.waiting && `${counts.waiting} ${counts.waiting === 1 ? "needs" : "need"} a week`,
    counts.left && `${counts.left} left out`,
  ]
    .filter(Boolean)
    .join(" · ");
  const manyFiles = new Set(rows.map((row) => row.name)).size > 1;

  return (
    <>
      <Button type="button" variant={variant} className={className} onClick={() => fileRef.current?.click()}>
        <FileUpIcon />
        {label}
        {label === "Import" && <span className="sr-only"> weeks from Square</span>}
      </Button>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".csv,text/csv"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const list = event.target.files;
          void choose(list).finally(() => {
            event.target.value = "";
          });
        }}
      />

      <Sheet open={files !== null} onOpenChange={(open) => !open && !pending && setFiles(null)}>
        <ResponsiveSheetContent>
          <SheetHeader className="pr-12">
            <SheetTitle>Import from Square</SheetTitle>
            <SheetDescription>
              {tooMany
                ? `Choose up to ${MAX_FILES} files at a time.`
                : `Weeks from Square's sales summary. ${summary}.`}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4">
            {error && (
              <Alert variant="destructive">
                <CircleAlertIcon />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {rows.length > 0 && (
              <ul className="divide-y overflow-hidden rounded-lg border">
                {rows.map((row) => {
                  const file = files?.find((entry) => entry.key === row.key);
                  return (
                    <li key={row.key}>
                      <ImportRow
                        row={row}
                        today={today}
                        showName={manyFiles}
                        picked={file?.parsed.ok && !file.parsed.week_ending ? (file.picked ?? null) : undefined}
                        saved={row.status === "existing" ? saved.get(row.week_ending) : undefined}
                        replacing={row.status === "existing" && replace.has(row.week_ending)}
                        onPick={(week) => pick(row.key, week)}
                        onReplace={(on) => row.status === "existing" && toggleReplace(row.week_ending, on)}
                      />
                    </li>
                  );
                })}
              </ul>
            )}

            {counts.left > 0 && (
              <p className="text-sm text-muted-foreground">Anything left out isn&apos;t saved. The rest still go in.</p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 px-4 pt-2 desktop:flex-row desktop:justify-end">
            <SheetClose asChild>
              <Button type="button" variant="outline" className="h-11 desktop:min-w-28" disabled={pending}>
                Cancel
              </Button>
            </SheetClose>
            <Button
              type="button"
              className="h-11 desktop:min-w-28"
              disabled={pending || saving === 0}
              onClick={() => void runImport()}
            >
              {pending ? "Importing…" : saving ? `Import ${weekCount(saving)}` : "Nothing to import"}
            </Button>
          </div>
        </ResponsiveSheetContent>
      </Sheet>
    </>
  );
}

function amounts(lines: CafeLines): string {
  return `Gross ${formatCents(lines.sales_cents)} · From Square ${formatCents(moneyFromSquare(lines))}`;
}

function ImportRow({
  row,
  today,
  showName,
  picked,
  saved,
  replacing,
  onPick,
  onReplace,
}: {
  row: CafeImportRow;
  today: IsoDate;
  /** Whether to say which file a week came from, when more than one was picked. */
  showName: boolean;
  /** The week picked for a file whose name has no dates, null before one is. Undefined for other files. */
  picked: IsoDate | null | undefined;
  saved: CafeWeek | undefined;
  replacing: boolean;
  onPick: (week: IsoDate) => void;
  onReplace: (on: boolean) => void;
}) {
  const switchId = `cafe-import-replace-${row.key}`;
  const badge =
    row.status === "new" ? (
      <Badge variant="secondary">New</Badge>
    ) : row.status === "existing" ? (
      <Badge variant="outline">{replacing ? "Replacing" : "Already entered"}</Badge>
    ) : row.status === "needs_week" ? (
      <Badge variant="outline">Pick a week</Badge>
    ) : (
      <Badge variant="destructive">Left out</Badge>
    );

  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="truncate font-medium">
            {"week_ending" in row ? weekLabel(row.week_ending, today) : row.name}
          </p>
          {row.status === "error" ? (
            <p className="text-sm text-destructive">{row.error}</p>
          ) : (
            <p className="text-sm text-muted-foreground tabular-nums">{amounts(row.lines)}</p>
          )}
          {row.status === "existing" && saved && (
            <p className="text-sm text-muted-foreground tabular-nums">Entered now: {amounts(saved)}</p>
          )}
          {showName && "week_ending" in row && <p className="truncate text-xs text-muted-foreground">{row.name}</p>}
        </div>
        <span className="shrink-0">{badge}</span>
      </div>

      {picked === null && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">This file&apos;s name has no dates, so pick the week it covers.</p>
          <Button type="button" variant="outline" className="h-11 w-full" onClick={() => onPick(defaultWeekEnding(today))}>
            Pick the week
          </Button>
        </div>
      )}
      {picked && (
        <WeekPicker
          id={`cafe-import-week-${row.key}`}
          week={picked}
          today={today}
          entered={row.status === "existing"}
          onPick={onPick}
        />
      )}

      {row.status === "existing" && (
        <div
          className={cn(
            "flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2",
            replacing && "border-primary/50",
          )}
        >
          <Label htmlFor={switchId} className="text-base font-normal desktop:text-sm">
            Replace what&apos;s entered
          </Label>
          <Switch id={switchId} checked={replacing} onCheckedChange={onReplace} />
        </div>
      )}
    </div>
  );
}

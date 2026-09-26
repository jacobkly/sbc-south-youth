"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { CircleAlertIcon, DownloadIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ResponsiveSheetContent } from "@/components/ui/responsive-sheet";
import { Sheet, SheetClose, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { periodLabel } from "@/lib/dates";
import { formatStorage } from "@/lib/receipts/storage";
import { receiptsZipFileName } from "@/lib/reports/export";
import type { ReportFilters } from "@/lib/reports/filters";
import {
  buildReceiptsZip,
  LARGE_ZIP_BYTES,
  loadZipReceipts,
  receiptZipEntries,
  type ZipEntry,
  type ZipRequest,
} from "@/lib/reports/receipts-zip";
import { createClient } from "@/lib/supabase/client";

/** The report a ZIP is made from: its filters and the requests it shows. */
export type ZipReport = { filters: ReportFilters; rows: readonly ZipRequest[] };

type ZipList = { entries: ZipEntry[]; bytes: number; requests: number; missing: number };

type ZipState =
  | { step: "listing" }
  | { step: "list-failed" }
  | { step: "ready"; list: ZipList; error?: string }
  | { step: "building"; list: ZipList; done: number }
  | { step: "done"; list: ZipList; url: string; name: string; size: number };

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}

/** What a screen reader hears at each step. Not every file, which would be noise. */
function announcement(state: ZipState): string {
  switch (state.step) {
    case "listing":
    case "list-failed":
      return "";
    case "ready":
      if (state.error) return "";
      return state.list.entries.length === 0
        ? "No receipts in this report."
        : `Found ${plural(state.list.entries.length, "receipt", "receipts")}.`;
    case "building":
      return "Downloading receipts.";
    case "done":
      return "Your ZIP is ready to save.";
  }
}

/**
 * Downloads a report's receipts as one ZIP. The browser fetches each file
 * and builds the ZIP itself, so nothing new runs on a server. The ZIP is
 * saved with a tap at the end, which iOS Safari needs to allow a download.
 */
export function ReceiptsZipSheet({
  report,
  open,
  onOpenChange,
  returnFocus,
}: {
  report: ZipReport;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes on close, since the menu item that opened the sheet is gone by then. */
  returnFocus: RefObject<HTMLElement | null>;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <ResponsiveSheetContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus.current?.focus();
        }}
      >
        <SheetHeader className="pr-12">
          <SheetTitle>Download receipts</SheetTitle>
          <SheetDescription>
            Every receipt in the report for {periodLabel(report.filters.period)}, named by request, date, and payee.
          </SheetDescription>
        </SheetHeader>
        {/* Mounted while open, so each open starts over and closing stops a download. */}
        <ReceiptsZipBody report={report} />
      </ResponsiveSheetContent>
    </Sheet>
  );
}

function ReceiptsZipBody({ report: opened }: { report: ZipReport }) {
  // The report as it was when the sheet opened, so a refresh behind the
  // sheet can't reset the list or a download partway through.
  const [report] = useState(opened);
  const [state, setState] = useState<ZipState>({ step: "listing" });
  const [attempt, setAttempt] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const url = useRef<string | null>(null);

  useEffect(() => {
    let current = true;
    const ids = report.rows.map((row) => row.id);
    loadZipReceipts(createClient(), ids).then(
      (receipts) => {
        if (!current) return;
        const entries = receiptZipEntries(report.rows, receipts);
        const requests = new Set(receipts.map((receipt) => receipt.request_id)).size;
        setState({
          step: "ready",
          list: {
            entries,
            bytes: entries.reduce((sum, entry) => sum + entry.size, 0),
            requests,
            missing: report.rows.length - requests,
          },
        });
      },
      () => {
        if (current) setState({ step: "list-failed" });
      },
    );
    return () => {
      current = false;
    };
  }, [report.rows, attempt]);

  useEffect(
    () => () => {
      controller.current?.abort();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );

  async function build(list: ZipList) {
    const abort = new AbortController();
    controller.current = abort;
    setState({ step: "building", list, done: 0 });
    try {
      const zip = await buildReceiptsZip(
        createClient(),
        list.entries,
        (done) => setState({ step: "building", list, done }),
        abort.signal,
      );
      if (abort.signal.aborted) return;
      url.current = URL.createObjectURL(zip);
      setState({ step: "done", list, url: url.current, name: receiptsZipFileName(report.filters), size: zip.size });
    } catch (error) {
      if (abort.signal.aborted) return;
      console.error(error);
      setState({ step: "ready", list, error: "Couldn't download every receipt. Check your connection and try again." });
    }
  }

  function cancel(list: ZipList) {
    controller.current?.abort();
    setState({ step: "ready", list });
  }

  return (
    <div className="space-y-4 px-4">
      <p className="sr-only" role="status">
        {announcement(state)}
      </p>

      {state.step === "listing" && (
        <p className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
          Finding receipts…
        </p>
      )}

      {state.step === "list-failed" && (
        <>
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Couldn&apos;t find the receipts</AlertTitle>
            <AlertDescription>Check your connection and try again.</AlertDescription>
          </Alert>
          <Actions>
            <Button
              type="button"
              className="h-11 desktop:min-w-28"
              onClick={() => {
                setState({ step: "listing" });
                setAttempt((count) => count + 1);
              }}
            >
              Try again
            </Button>
          </Actions>
        </>
      )}

      {state.step === "ready" && state.list.entries.length === 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {report.rows.length === 0 ? "There are no requests in this report." : "No receipts in this report."}
          </p>
          <Actions />
        </>
      )}

      {state.step === "ready" && state.list.entries.length > 0 && (
        <>
          <ListSummary list={state.list} />
          {state.list.bytes > LARGE_ZIP_BYTES && (
            <Alert role="note">
              <TriangleAlertIcon />
              <AlertDescription>
                This is a big download. On a phone it can take a while, so keep this screen open until it&apos;s done.
              </AlertDescription>
            </Alert>
          )}
          {state.error && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>The ZIP didn&apos;t finish</AlertTitle>
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <Actions>
            <Button type="button" className="h-11 desktop:min-w-28" onClick={() => void build(state.list)}>
              <DownloadIcon aria-hidden />
              {state.error ? "Try again" : "Download ZIP"}
            </Button>
          </Actions>
        </>
      )}

      {state.step === "building" && (
        <>
          <Progress done={state.done} total={state.list.entries.length} />
          <div className="flex pt-2 desktop:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full desktop:w-auto desktop:min-w-28"
              onClick={() => cancel(state.list)}
            >
              Stop
            </Button>
          </div>
        </>
      )}

      {state.step === "done" && (
        <>
          <p className="text-sm">
            Your ZIP is ready: {plural(state.list.entries.length, "receipt", "receipts")}, {formatStorage(state.size)}.
          </p>
          <p className="text-sm break-all text-muted-foreground">{state.name}</p>
          <Actions>
            <Button asChild className="h-11 desktop:min-w-28">
              <a href={state.url} download={state.name}>
                <DownloadIcon aria-hidden />
                Save ZIP
              </a>
            </Button>
          </Actions>
        </>
      )}
    </div>
  );
}

function ListSummary({ list }: { list: ZipList }) {
  return (
    <div className="space-y-1 text-sm">
      <p>
        {plural(list.entries.length, "receipt", "receipts")} from {plural(list.requests, "request", "requests")},{" "}
        {formatStorage(list.bytes)}.
      </p>
      {list.missing > 0 && (
        <p className="text-muted-foreground">
          {list.missing === 1 ? "1 request has" : `${list.missing.toLocaleString()} requests have`} no receipt.
        </p>
      )}
    </div>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  const zipping = done === total;
  const text = zipping ? "Making the ZIP…" : `Downloading ${done.toLocaleString()} of ${total.toLocaleString()}…`;
  return (
    <div className="space-y-2">
      <p id="receipts-zip-progress" className="flex items-center gap-2 text-sm">
        <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
        {text}
      </p>
      <div
        role="progressbar"
        aria-labelledby="receipts-zip-progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(done / total) * 100}%` }} />
      </div>
    </div>
  );
}

/** "Close", then the main action. Stacked on phones with the main action on top. */
function Actions({ children }: { children?: ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-2 pt-2 desktop:flex-row desktop:justify-end">
      <SheetClose asChild>
        <Button type="button" variant="outline" className="h-11 desktop:min-w-28">
          Close
        </Button>
      </SheetClose>
      {children}
    </div>
  );
}

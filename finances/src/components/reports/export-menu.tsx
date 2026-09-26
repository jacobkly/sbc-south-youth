"use client";

import { useRef, useState } from "react";
import { ChevronDownIcon, DownloadIcon, FileArchiveIcon, SheetIcon, SigmaIcon } from "lucide-react";
import { ReceiptsZipSheet, type ZipReport } from "@/components/reports/receipts-zip-sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { reportExportHref, type ReportFilters } from "@/lib/reports/filters";

/**
 * The report's downloads. The CSVs are plain links, so the browser downloads
 * the file itself, and they export the report being picked, even mid-load.
 * The receipts ZIP is built from the loaded report, so it waits for a load
 * to finish.
 */
export function ExportMenu({
  filters,
  report,
  loading,
}: {
  filters: ReportFilters;
  report: ZipReport;
  loading: boolean;
}) {
  const [zipOpen, setZipOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button ref={trigger} variant="outline" className="h-11">
            <DownloadIcon aria-hidden />
            Export
            <ChevronDownIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-64">
          <DropdownMenuItem asChild className="min-h-11 items-start py-2">
            <a href={reportExportHref(filters)} download>
              <SheetIcon aria-hidden className="mt-0.5" />
              <span>
                <span className="block">Requests CSV</span>
                <span className="block text-xs text-muted-foreground">One line per request</span>
              </span>
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="min-h-11 items-start py-2">
            <a href={reportExportHref(filters, "summary")} download>
              <SigmaIcon aria-hidden className="mt-0.5" />
              <span>
                <span className="block">Summary CSV</span>
                <span className="block text-xs text-muted-foreground">Totals by payee and type</span>
              </span>
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11 items-start py-2"
            disabled={loading}
            onSelect={() => setZipOpen(true)}
          >
            <FileArchiveIcon aria-hidden className="mt-0.5" />
            <span>
              <span className="block">Receipts ZIP</span>
              <span className="block text-xs text-muted-foreground">
                {loading ? "Waiting for the report to load" : "Every receipt file"}
              </span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ReceiptsZipSheet report={report} open={zipOpen} onOpenChange={setZipOpen} returnFocus={trigger} />
    </>
  );
}

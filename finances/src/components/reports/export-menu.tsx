"use client";

import { ChevronDownIcon, DownloadIcon, SheetIcon, SigmaIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { reportExportHref, type ReportFilters } from "@/lib/reports/filters";

/**
 * The report's downloads. Each is a plain link, so the browser downloads
 * the file itself, and each exports the report being picked, even mid-load.
 */
export function ExportMenu({ filters }: { filters: ReportFilters }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-11">
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

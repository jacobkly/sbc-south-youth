import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canUseArea } from "@/lib/auth/roles";
import type { Database } from "@/lib/database.types";
import { periodRange, todayInLA } from "@/lib/dates";
import { loadIncomeIn } from "@/lib/income/queries";
import {
  incomeCsv,
  incomeFileName,
  reportCsv,
  reportFileName,
  summaryCsv,
  summaryFileName,
} from "@/lib/reports/export";
import { parseReportFilters, type ReportFile, type ReportFilters } from "@/lib/reports/filters";
import { loadReport, loadReportExport } from "@/lib/requests/queries";
import { createClient } from "@/lib/supabase/server";

type ExportFile = {
  name: (filters: ReportFilters) => string;
  build: (supabase: SupabaseClient<Database>, filters: ReportFilters) => Promise<string>;
};

/** Each file's name and how to build it. */
const FILES: Record<ReportFile, ExportFile> = {
  requests: {
    name: reportFileName,
    build: async (supabase, filters) => reportCsv(await loadReportExport(supabase, filters)),
  },
  summary: {
    name: summaryFileName,
    build: async (supabase, filters) => summaryCsv(await loadReport(supabase, filters)),
  },
  income: {
    name: incomeFileName,
    build: async (supabase, filters) => incomeCsv(await loadIncomeIn(supabase, periodRange(filters.period))),
  },
};

/**
 * The report as a CSV download, for the same period and filters as the
 * page: one line per request, the totals with `file=summary`, or one line
 * per income entry with `file=income`. Route handlers skip the app shell, so
 * this checks access itself.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !canUseArea(user, "team")) {
    return new Response("You don't have access to reports.", { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const filters = parseReportFilters(Object.fromEntries(params), todayInLA());
  const requested = params.get("file");
  // Anything unrecognized gets the default, one line per request.
  const file = requested === "summary" || requested === "income" ? FILES[requested] : FILES.requests;
  const supabase = await createClient();

  let csv;
  try {
    csv = await file.build(supabase, filters);
  } catch (error) {
    console.error(error);
    return new Response("Couldn't export the report. Go back and try again.", { status: 500 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file.name(filters)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

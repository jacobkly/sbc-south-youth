import type { NextRequest } from "next/server";
import { canUseApp, getCurrentUser } from "@/lib/auth/current-user";
import { todayInLA } from "@/lib/dates";
import { reportCsv, reportFileName } from "@/lib/reports/export";
import { parseReportFilters } from "@/lib/reports/filters";
import { loadReportExport } from "@/lib/requests/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * The report as a CSV download, for the same period and filters as the
 * page. Route handlers skip the app shell, so this checks access itself.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !canUseApp(user)) {
    return new Response("You don't have access to reports.", { status: 403 });
  }

  const filters = parseReportFilters(Object.fromEntries(request.nextUrl.searchParams), todayInLA());
  const supabase = await createClient();

  let rows;
  try {
    rows = await loadReportExport(supabase, filters);
  } catch (error) {
    console.error(error);
    return new Response("Couldn't export the report. Go back and try again.", { status: 500 });
  }

  return new Response(reportCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${reportFileName(filters)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

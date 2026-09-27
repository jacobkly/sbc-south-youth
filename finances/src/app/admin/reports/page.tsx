import type { Metadata } from "next";
import { ReportView } from "@/components/reports/report-view";
import { todayInLA } from "@/lib/dates";
import { parseReportFilters, parseReportPage } from "@/lib/reports/filters";
import { loadReport } from "@/lib/requests/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Reports",
};

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const today = todayInLA();
  const params = await searchParams;
  const filters = parseReportFilters(params, today);
  const supabase = await createClient();
  // loadReport throws on failure, and admin/error.tsx handles it.
  const rows = await loadReport(supabase, filters);

  return <ReportView filters={filters} page={parseReportPage(params)} today={today} rows={rows} />;
}

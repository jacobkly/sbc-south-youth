import type { Metadata } from "next";
import { ReportView } from "@/components/reports/report-view";
import { todayInLA } from "@/lib/dates";
import { comparisonPeriod } from "@/lib/reports/comparison";
import { parseReportFilters, parseReportPage, parseReportTab } from "@/lib/reports/filters";
import { loadReport, loadReportAmounts, loadReturningPayees } from "@/lib/requests/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Reports",
};

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const today = todayInLA();
  const params = await searchParams;
  const filters = parseReportFilters(params, today);
  const beforePeriod = comparisonPeriod(filters.period, today);
  const supabase = await createClient();
  // Each throws on failure, and admin/error.tsx handles it.
  const [rows, beforeRows, returning] = await Promise.all([
    loadReport(supabase, filters),
    loadReportAmounts(supabase, { ...filters, period: beforePeriod }),
    loadReturningPayees(supabase, filters),
  ]);

  return (
    <ReportView
      filters={filters}
      tab={parseReportTab(params)}
      page={parseReportPage(params)}
      today={today}
      rows={rows}
      before={{ period: beforePeriod, rows: beforeRows }}
      returning={returning}
    />
  );
}

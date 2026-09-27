import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheetIcon, PlusIcon, ReceiptTextIcon } from "lucide-react";
import { LatestRequests } from "@/components/dashboard/latest-requests";
import { MonthlyChart } from "@/components/dashboard/monthly-chart";
import { NeedsAction } from "@/components/dashboard/needs-action";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { StatCards } from "@/components/dashboard/stat-cards";
import { TopPayees } from "@/components/dashboard/top-payees";
import { TypeSplitChart } from "@/components/dashboard/type-split-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loadDashboard } from "@/lib/dashboard/summary";
import { todayInLA } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  // loadDashboard throws on failure, and admin/error.tsx handles it.
  const [user, summary] = await Promise.all([getCurrentUser(), loadDashboard(supabase, todayInLA())]);
  const canEdit = user?.role === "admin";
  const firstName = user?.full_name.trim().split(/\s+/)[0];

  return (
    <div className="space-y-6">
      <div className="space-y-4 desktop:flex desktop:items-end desktop:justify-between desktop:gap-4 desktop:space-y-0">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {firstName ? `Welcome, ${firstName}. ` : ""}Here&apos;s where things stand.
          </p>
        </div>
        <QuickActions canEdit={canEdit} />
      </div>

      {summary.hasRequests ? (
        // On a PC, two columns that each stack on their own, so neither waits
        // for the other: what needs action, paid by month, and the latest
        // requests on the left, and the totals, top payees, and the cafe and
        // youth split on the right. Stats spans the first two rows, so the
        // left column starts right under what needs action. The last row is
        // flexible, so a taller left column stretches only that row. Margins
        // stand in for row gaps, so a row that ends up empty adds no space.
        // The last card in each column stretches, so both end together.
        <div className="grid grid-cols-1 gap-6 @4xl/main:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] @4xl/main:grid-rows-[auto_auto_1fr] @4xl/main:items-start @4xl/main:gap-y-0">
          <div className="@4xl/main:mb-6">
            <NeedsAction summary={summary} />
          </div>
          <div className="@4xl/main:row-span-2 @4xl/main:mb-6">
            <StatCards summary={summary} />
          </div>
          <div className="grid grid-cols-1 gap-6 @4xl/main:row-span-2 @4xl/main:grid-rows-[auto_1fr] @4xl/main:self-stretch">
            <MonthlyChart months={summary.paidByMonth} />
            <LatestRequests rows={summary.latest} />
          </div>
          <div className="grid grid-cols-1 gap-6 @4xl/main:grid-rows-[auto_1fr] @4xl/main:self-stretch">
            <TopPayees payees={summary.topPayees} period={summary.paid.year.period} activePayees={summary.activePayees} />
            <TypeSplitChart paid={summary.paid} />
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <span
              aria-hidden
              className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              <ReceiptTextIcon className="size-6" />
            </span>
            <div className="space-y-1">
              <h2 className="font-semibold">No requests yet</h2>
              <p className="text-sm text-muted-foreground">
                Totals, charts, and what needs doing show up here once requests are entered.
              </p>
            </div>
            {canEdit && (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button className="h-11 px-5" asChild>
                  <Link href="/admin/requests/new">
                    <PlusIcon aria-hidden />
                    Enter the first request
                  </Link>
                </Button>
                <Button variant="outline" className="h-11 px-5" asChild>
                  <Link href="/admin/settings/import">
                    <FileSpreadsheetIcon aria-hidden />
                    Import a spreadsheet
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

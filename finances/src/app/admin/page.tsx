import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { MonthlyChart } from "@/components/dashboard/monthly-chart";
import { StorageBar } from "@/components/dashboard/storage-bar";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { TypeSplitChart } from "@/components/dashboard/type-split-chart";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome, {user?.full_name}.</p>
      </div>

      {summary.hasRequests ? (
        <>
          <SummaryCards summary={summary} />
          <MonthlyChart months={summary.paidByMonth} />
          <TypeSplitChart paid={summary.paid} />
        </>
      ) : (
        <div className="space-y-3 rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          <p>No requests yet. Totals show up here once requests are entered.</p>
          {user?.role === "admin" && (
            <Button className="h-11 px-5" asChild>
              <Link href="/admin/requests/new">
                <PlusIcon aria-hidden />
                Enter the first request
              </Link>
            </Button>
          )}
        </div>
      )}

      <StorageBar bytes={summary.storageBytes} />
    </div>
  );
}

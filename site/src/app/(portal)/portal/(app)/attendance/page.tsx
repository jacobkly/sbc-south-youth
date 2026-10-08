import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Tally5Icon, TriangleAlertIcon } from "lucide-react";
import { HeadcountForm } from "@/components/portal/attendance/headcount-form";
import { HeadcountList } from "@/components/portal/attendance/headcount-list";
import { HeadcountTiles } from "@/components/portal/attendance/headcount-tiles";
import { Alert, AlertDescription } from "@/components/portal/ui/alert";
import { todayInLA } from "@/lib/dates";
import { readPortalEnv } from "@/lib/env";
import { summarize } from "@/lib/portal/attendance/headcount";
import { loadHeadcounts } from "@/lib/portal/attendance/queries";
import { getCurrentUser } from "@/lib/portal/auth/current-user";
import { hasRole } from "@/lib/portal/roles";

export const metadata: Metadata = {
  title: "Attendance",
};

export default async function AttendancePage() {
  // The Attendance role, finance viewers, and owners. RLS keeps everyone else from reading headcounts anyway.
  const me = await getCurrentUser();
  if (!me || !hasRole(me.roles, "attendance", "finance_viewer")) notFound();

  const canEdit = hasRole(me.roles, "attendance");
  const readOnly = readPortalEnv().appEnv === "staging";
  const today = todayInLA();
  const counts = await loadHeadcounts();
  const summary = summarize(counts);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground">How many came to youth each week, leaders included.</p>
      </header>

      {canEdit && readOnly && (
        <Alert>
          <TriangleAlertIcon />
          <AlertDescription>
            This is the staging copy of the portal, so it can&apos;t change headcounts. Use the real portal to add
            them.
          </AlertDescription>
        </Alert>
      )}

      {/* On a PC, adding a night and the totals on the left, and every night on the right. */}
      <div className="grid grid-cols-1 gap-8 @4xl/main:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] @4xl/main:items-start">
        {(canEdit || summary) && (
          <div className="space-y-8">
            {canEdit && <HeadcountForm counts={counts} today={today} readOnly={readOnly} />}
            {summary && <HeadcountTiles summary={summary} today={today} />}
          </div>
        )}

        {summary ? (
          <HeadcountList counts={counts} today={today} canEdit={canEdit} readOnly={readOnly} />
        ) : (
          <section
            aria-labelledby="empty-heading"
            className="space-y-3 rounded-xl border border-dashed p-6 text-center"
          >
            <Tally5Icon className="mx-auto size-6 text-muted-foreground" aria-hidden />
            <div className="space-y-1">
              <h2 id="empty-heading" className="font-semibold">
                No nights counted yet
              </h2>
              <p className="text-sm text-balance text-muted-foreground">
                {canEdit
                  ? "Once you add the first night, each one shows here, newest first."
                  : "Once someone with Attendance adds a night's count, it shows here."}
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

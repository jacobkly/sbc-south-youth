import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActivityFeed, EmptyActivity } from "@/components/activity/activity-feed";
import { ActivityView } from "@/components/activity/activity-view";
import { getCurrentUser } from "@/lib/auth/current-user";
import { groupBursts, groupByDay, parseActivityFilters } from "@/lib/activity/feed";
import { incomeSubjects, mergeIncome } from "@/lib/activity/income";
import { loadActivity, loadCurrentIncome } from "@/lib/activity/queries";
import { todayInLA } from "@/lib/dates";
import { loadPayeeNames } from "@/lib/requests/queries";
import { changedPayeeIds } from "@/lib/requests/status";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Activity",
};

export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  // Only admins get the feed. Viewers still see each request's own history.
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/admin");

  const today = todayInLA();
  const filters = parseActivityFilters(await searchParams, today);
  const supabase = await createClient();
  // Each throws on failure, and admin/error.tsx handles it.
  const { events, income, older, capped } = await loadActivity(supabase, filters, today);
  const [payeeNames, currentIncome] = await Promise.all([
    loadPayeeNames(supabase, changedPayeeIds(events)),
    loadCurrentIncome(supabase, income),
  ]);
  const days = groupByDay(mergeIncome(groupBursts(events), income), today);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
      <ActivityView filters={filters} older={older} capped={capped}>
        {days.length === 0 ? (
          <EmptyActivity kind={filters.kind} />
        ) : (
          <ActivityFeed
            days={days}
            payeeNames={payeeNames}
            incomeSubjects={incomeSubjects(income, currentIncome)}
            today={today}
            currentUserId={user.id}
          />
        )}
      </ActivityView>
    </div>
  );
}

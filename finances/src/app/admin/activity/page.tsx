import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActivityFeed, EmptyActivity } from "@/components/activity/activity-feed";
import { ActivityView } from "@/components/activity/activity-view";
import { getCurrentUser } from "@/lib/auth/current-user";
import { groupBursts, groupByDay, parseActivityFilters } from "@/lib/activity/feed";
import { loadActivity } from "@/lib/activity/queries";
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

  const filters = parseActivityFilters(await searchParams);
  const supabase = await createClient();
  // Each throws on failure, and admin/error.tsx handles it.
  const { events, hasMore, capped } = await loadActivity(supabase, filters);
  const payeeNames = await loadPayeeNames(supabase, changedPayeeIds(events));
  const days = groupByDay(groupBursts(events), todayInLA());

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
      <ActivityView filters={filters} hasMore={hasMore} capped={capped}>
        {days.length === 0 ? (
          <EmptyActivity kind={filters.kind} />
        ) : (
          <ActivityFeed days={days} payeeNames={payeeNames} currentUserId={user.id} />
        )}
      </ActivityView>
    </div>
  );
}

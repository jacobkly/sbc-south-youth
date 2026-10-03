import { ActivityFeedSkeleton, ActivityFiltersSkeleton } from "@/components/portal/activity/activity-skeleton";
import { NarrowPage } from "@/components/portal/nav/app-shell";

// Shown at once when someone opens Activity from another portal page.
export default function ActivityLoading() {
  return (
    <NarrowPage className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
      <div className="space-y-4">
        <ActivityFiltersSkeleton />
        <ActivityFeedSkeleton />
      </div>
    </NarrowPage>
  );
}

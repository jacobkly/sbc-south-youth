import { ActivityFeedSkeleton } from "@/components/activity/activity-feed";
import { Skeleton } from "@/components/ui/skeleton";

export default function ActivityLoading() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
      <div className="flex flex-wrap gap-2">
        {[12, 20, 20, 16, 14].map((width, index) => (
          <Skeleton key={index} className="h-10 rounded-full" style={{ width: `${width * 0.25}rem` }} />
        ))}
      </div>
      <div className="mt-2">
        <ActivityFeedSkeleton />
      </div>
    </div>
  );
}

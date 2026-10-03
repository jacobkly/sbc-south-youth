import { Skeleton } from "@/components/portal/ui/skeleton";

/** A day of feed items while the next ones load. */
export function ActivityFeedSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading activity">
      <Skeleton className="h-4 w-20" />
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {[0, 1, 2, 3].map((index) => (
          <li key={index} className="flex items-start gap-3 p-4">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-14" />
              </div>
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The filter buttons while the screen loads. */
export function ActivityFiltersSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      {[24, 22, 28].map((width) => (
        <Skeleton key={width} className="h-10 rounded-full" style={{ width: `${width * 0.25}rem` }} />
      ))}
    </div>
  );
}

import { NarrowPage } from "@/components/portal/nav/app-shell";
import { Skeleton } from "@/components/portal/ui/skeleton";

// Shown at once when a site editor opens an event from Events.
export default function EventLoading() {
  return (
    <NarrowPage>
      <div className="space-y-8" aria-busy="true" aria-label="Loading">
        <div className="space-y-2">
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-5 w-64 max-w-full" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
          </div>
          <Skeleton className="h-11 w-32" />
        </div>
      </div>
    </NarrowPage>
  );
}

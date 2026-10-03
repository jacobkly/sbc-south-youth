import { NarrowPage } from "@/components/portal/nav/app-shell";
import { Skeleton } from "@/components/portal/ui/skeleton";

// Shown at once when someone opens a message from Messages.
export default function MessageLoading() {
  return (
    <NarrowPage>
      <div className="space-y-8" aria-busy="true" aria-label="Loading">
        <div className="space-y-3">
          <Skeleton className="h-11 w-28" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-56 max-w-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </NarrowPage>
  );
}

import { NarrowPage } from "@/components/portal/nav/app-shell";
import { Skeleton } from "@/components/portal/ui/skeleton";

// Shown at once when a site editor starts an event.
export default function NewEventLoading() {
  return (
    <NarrowPage className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-11 w-20" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>
      <div className="space-y-6" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-11 w-32" />
      </div>
    </NarrowPage>
  );
}

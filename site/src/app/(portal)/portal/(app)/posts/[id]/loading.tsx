import { NarrowPage } from "@/components/portal/nav/app-shell";
import { Skeleton } from "@/components/portal/ui/skeleton";

// Shown at once when a site editor opens a heads-up from Posts.
export default function PostLoading() {
  return (
    <NarrowPage>
      <div className="space-y-8" aria-busy="true" aria-label="Loading">
        <div className="space-y-2">
          <Skeleton className="h-11 w-20" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-64 max-w-full" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-11 w-32" />
        </div>
      </div>
    </NarrowPage>
  );
}

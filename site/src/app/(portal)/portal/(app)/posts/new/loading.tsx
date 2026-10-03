import { NarrowPage } from "@/components/portal/nav/app-shell";
import { Skeleton } from "@/components/portal/ui/skeleton";

// Shown at once when a site editor starts a heads-up.
export default function NewPostLoading() {
  return (
    <NarrowPage className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-11 w-20" />
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>
      <div className="space-y-6" aria-busy="true" aria-label="Loading">
        <div className="flex gap-2">
          <Skeleton className="h-11 w-32 rounded-full" />
          <Skeleton className="h-11 w-40 rounded-full" />
        </div>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-11 w-32" />
      </div>
    </NarrowPage>
  );
}

import { NarrowPage } from "@/components/portal/nav/app-shell";
import { Skeleton } from "@/components/portal/ui/skeleton";

// Shown at once when an owner opens someone from People.
export default function PersonLoading() {
  return (
    <NarrowPage>
      <div className="space-y-8" aria-busy="true" aria-label="Loading">
        <div className="space-y-4">
          <Skeleton className="h-11 w-24" />
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-7 w-44" />
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
    </NarrowPage>
  );
}

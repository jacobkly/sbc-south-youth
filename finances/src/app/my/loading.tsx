import { NarrowPage } from "@/components/nav/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function MyRequestsLoading() {
  return (
    <NarrowPage>
      <div className="space-y-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </NarrowPage>
  );
}

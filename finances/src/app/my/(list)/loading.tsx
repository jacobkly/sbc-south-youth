import { Busy } from "@/components/loading/page-skeletons";
import { NarrowPage } from "@/components/nav/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

// In a group of its own, so it also shows when coming back from a request.
export default function MyRequestsLoading() {
  return (
    <NarrowPage className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">My requests</h1>
      <Busy label="Loading your requests">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </Busy>
    </NarrowPage>
  );
}

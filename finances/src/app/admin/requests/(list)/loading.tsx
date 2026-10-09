import { RequestListSkeleton } from "@/components/requests/request-list";
import { Skeleton } from "@/components/ui/skeleton";

// In a group of its own, so it also shows when coming back from a request.
export default function RequestsLoading() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Requests</h1>
      <div className="flex gap-2" aria-hidden>
        <Skeleton className="h-11 min-w-0 flex-1" />
        <Skeleton className="size-11" />
      </div>
      <Skeleton className="h-10 w-full @4xl/main:w-96" aria-hidden />
      <RequestListSkeleton />
    </div>
  );
}

import { NarrowPage } from "@/components/portal/nav/app-shell";
import { Skeleton } from "@/components/portal/ui/skeleton";

// Shown at once when someone opens Account from another portal page.
export default function AccountLoading() {
  return (
    <NarrowPage className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
      <div className="space-y-6" aria-busy="true" aria-label="Loading">
        <div className="flex items-center gap-4">
          <Skeleton className="size-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-36" />
          </div>
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </NarrowPage>
  );
}

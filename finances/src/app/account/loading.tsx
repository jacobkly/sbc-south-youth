import { Busy, FieldsSkeleton } from "@/components/loading/page-skeletons";
import { NarrowPage } from "@/components/nav/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function AccountLoading() {
  return (
    <NarrowPage className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
      <Busy label="Loading your account" className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-full" />
          <Skeleton className="h-11 w-32" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <FieldsSkeleton count={1} />
      </Busy>
    </NarrowPage>
  );
}

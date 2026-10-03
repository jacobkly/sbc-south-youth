import { NarrowPage } from "@/components/portal/nav/app-shell";
import { Skeleton } from "@/components/portal/ui/skeleton";

// Shown at once when an owner opens the invite form.
export default function InviteLoading() {
  return (
    <NarrowPage className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-11 w-24" />
        <h1 className="text-2xl font-semibold tracking-tight">Invite someone</h1>
      </div>
      <div className="space-y-6" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-11 w-32" />
      </div>
    </NarrowPage>
  );
}

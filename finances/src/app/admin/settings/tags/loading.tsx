import { Busy } from "@/components/loading/page-skeletons";
import { NarrowPage } from "@/components/nav/app-shell";
import { BackLink } from "@/components/nav/back-link";
import { Skeleton } from "@/components/ui/skeleton";

export default function TagsLoading() {
  return (
    <NarrowPage className="space-y-6">
      <div className="space-y-2">
        <BackLink fallbackHref="/admin/settings" fallbackLabel="Settings" />
        <h1 className="text-2xl font-semibold tracking-tight">Tags</h1>
      </div>
      <Busy label="Loading">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </Busy>
    </NarrowPage>
  );
}

import { Busy, FieldsSkeleton } from "@/components/loading/page-skeletons";
import { NarrowPage } from "@/components/nav/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

// In a group of its own, so it also shows when coming back from Tags or Import.
export default function SettingsLoading() {
  return (
    <NarrowPage className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <Busy label="Loading settings" className="space-y-6">
        <FieldsSkeleton count={3} />
        <div className="space-y-3 border-t pt-6">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-11 w-full" />
        </div>
      </Busy>
    </NarrowPage>
  );
}

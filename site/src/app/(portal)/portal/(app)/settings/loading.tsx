import { NarrowPage } from "@/components/portal/nav/app-shell";
import { Skeleton } from "@/components/portal/ui/skeleton";

// Shown at once when someone opens Settings from another portal page.
export default function SettingsLoading() {
  return (
    <NarrowPage className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <div className="space-y-3" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-6 w-28" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((tile) => (
            <Skeleton key={tile} className="aspect-[4/3] w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-4 w-3/4" />
      </div>
    </NarrowPage>
  );
}

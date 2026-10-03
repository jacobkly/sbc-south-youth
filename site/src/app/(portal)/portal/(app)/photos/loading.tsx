import { NarrowPage } from "@/components/portal/nav/app-shell";
import { Skeleton } from "@/components/portal/ui/skeleton";

// Shown at once when a site editor opens Photos from another portal page.
export default function PhotosLoading() {
  return (
    <NarrowPage className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Photos</h1>
          <p className="text-muted-foreground">The library for the public site.</p>
        </div>
        <Skeleton className="h-11 w-32 shrink-0" />
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-busy="true" aria-label="Loading">
        {[0, 1, 2, 3, 4, 5].map((tile) => (
          <li key={tile} className="space-y-1.5">
            <Skeleton className="aspect-4/3 w-full rounded-lg" />
            <Skeleton className="h-3 w-3/4" />
          </li>
        ))}
      </ul>
    </NarrowPage>
  );
}

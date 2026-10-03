import { NarrowPage } from "@/components/portal/nav/app-shell";
import { Skeleton } from "@/components/portal/ui/skeleton";

// Shown at once when an owner opens People from another portal page.
export default function PeopleLoading() {
  return (
    <NarrowPage className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">People</h1>
        <Skeleton className="h-11 w-24" />
      </div>
      <ul className="divide-y rounded-xl border bg-card" aria-busy="true" aria-label="Loading">
        {[0, 1, 2].map((row) => (
          <li key={row} className="flex items-start gap-3 p-4">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          </li>
        ))}
      </ul>
    </NarrowPage>
  );
}

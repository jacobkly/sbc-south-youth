import { NarrowPage } from "@/components/portal/nav/app-shell";
import { Skeleton } from "@/components/portal/ui/skeleton";

// Shown at once when a site editor opens Posts from another portal page.
export default function PostsLoading() {
  return (
    <NarrowPage className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Posts</h1>
          <p className="text-muted-foreground">Heads-ups on Home and This Week.</p>
        </div>
        <Skeleton className="h-11 w-20 shrink-0" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-24" />
        <ul className="divide-y rounded-xl border bg-card" aria-busy="true" aria-label="Loading">
          {[0, 1, 2].map((row) => (
            <li key={row} className="space-y-2 p-4">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-64 max-w-full" />
              <Skeleton className="h-3 w-36" />
            </li>
          ))}
        </ul>
      </div>
    </NarrowPage>
  );
}

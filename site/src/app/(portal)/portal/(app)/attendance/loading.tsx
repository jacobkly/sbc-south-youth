import { NarrowPage } from "@/components/portal/nav/app-shell";
import { Skeleton } from "@/components/portal/ui/skeleton";

// Shown at once when someone opens Attendance from another portal page.
export default function AttendanceLoading() {
  return (
    <NarrowPage className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground">How many came to youth each week, leaders included.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-busy="true" aria-label="Loading">
        {[0, 1, 2].map((tile) => (
          <div key={tile} className="space-y-2 rounded-xl border bg-card p-4 first:col-span-2 sm:first:col-span-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-14" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
      <ul className="divide-y rounded-xl border bg-card" aria-hidden>
        {[0, 1, 2, 3, 4].map((row) => (
          <li key={row} className="flex items-center justify-between gap-3 px-4 py-3.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-8" />
          </li>
        ))}
      </ul>
    </NarrowPage>
  );
}

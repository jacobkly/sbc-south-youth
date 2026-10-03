import { NarrowPage } from "@/components/portal/nav/app-shell";
import { Skeleton } from "@/components/portal/ui/skeleton";

// Shown at once when someone with Messages opens it from another portal page.
export default function MessagesLoading() {
  return (
    <NarrowPage className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="text-muted-foreground">What people send from the site&apos;s forms.</p>
      </div>
      <div className="space-y-3" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-[46px] w-full rounded-lg sm:w-104" />
        <div className="flex gap-2 overflow-hidden">
          {[48, 56, 56, 64, 72, 132].map((width, index) => (
            <Skeleton key={index} className="h-10 shrink-0 rounded-full" style={{ width }} />
          ))}
        </div>
      </div>
      <Skeleton className="h-5 w-64 max-w-full" />
      <ul className="divide-y rounded-xl border bg-card" aria-hidden>
        {[0, 1, 2, 3].map((row) => (
          <li key={row} className="space-y-2 p-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-72 max-w-full" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </li>
        ))}
      </ul>
    </NarrowPage>
  );
}

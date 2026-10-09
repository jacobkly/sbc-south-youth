import { Busy } from "@/components/loading/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// In a group of its own, so it also shows when coming back from a page under /admin.
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Skeleton className="h-5 w-56" />
      </div>
      <Busy
        label="Loading the dashboard"
        className="grid grid-cols-1 gap-6 space-y-0 @4xl/main:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] @4xl/main:items-start"
      >
        <div className="space-y-6">
          <Skeleton className="h-36" />
          <Skeleton className="h-64" />
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-48" />
        </div>
      </Busy>
    </div>
  );
}

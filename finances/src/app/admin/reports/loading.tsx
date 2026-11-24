import { Busy } from "@/components/loading/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      <Busy label="Loading the report" className="space-y-6">
        <Skeleton className="h-52 rounded-lg" />
        <Skeleton className="h-10 w-full @4xl/main:w-96" />
        <Skeleton className="h-56 rounded-lg @md/main:h-28" />
        <Skeleton className="h-64" />
      </Busy>
    </div>
  );
}

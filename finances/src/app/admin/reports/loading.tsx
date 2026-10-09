import { Busy } from "@/components/loading/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      <Busy label="Loading the report" className="space-y-6">
        <Skeleton className="h-52 rounded-lg" />
        <Skeleton className="h-10 w-full @4xl/main:w-96" />
        <div className="grid grid-cols-2 gap-3 desktop:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </Busy>
    </div>
  );
}

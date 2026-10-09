import { Busy } from "@/components/loading/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function IncomeLoading() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Income</h1>
      <Busy label="Loading income">
        <Skeleton className="h-10 w-full @4xl/main:w-72" />
        <div className="grid grid-cols-2 gap-2 desktop:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </Busy>
    </div>
  );
}

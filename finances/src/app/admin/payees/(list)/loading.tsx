import { Busy } from "@/components/loading/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// In a group of its own, so it also shows when coming back from a payee.
export default function PayeesLoading() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Payees</h1>
      <Busy label="Loading payees">
        <div className="space-y-4 @4xl/main:flex @4xl/main:items-center @4xl/main:gap-4 @4xl/main:space-y-0">
          <Skeleton className="h-11 w-full @4xl/main:w-96" />
          <Skeleton className="h-10 w-full @4xl/main:h-11 @4xl/main:w-72" />
        </div>
        <div className="divide-y rounded-xl border">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex min-h-16 items-center gap-3 px-4 py-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </Busy>
    </div>
  );
}

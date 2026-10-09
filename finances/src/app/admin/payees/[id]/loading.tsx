import { Busy } from "@/components/loading/page-skeletons";
import { BackLink } from "@/components/nav/back-link";
import { Skeleton } from "@/components/ui/skeleton";

export default function PayeeLoading() {
  return (
    <div className="space-y-2">
      <BackLink fallbackHref="/admin/payees" fallbackLabel="Payees" />
      <Busy label="Loading the payee" className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-6 @4xl/main:grid @4xl/main:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @4xl/main:items-start @4xl/main:gap-6 @4xl/main:space-y-0">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="col-span-2 h-20 md:col-span-1" />
          </div>
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-48" />
      </Busy>
    </div>
  );
}

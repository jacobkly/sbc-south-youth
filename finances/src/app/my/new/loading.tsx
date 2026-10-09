import { Busy, FieldsSkeleton } from "@/components/loading/page-skeletons";
import { NarrowPage } from "@/components/nav/app-shell";

export default function NewMyRequestLoading() {
  return (
    <NarrowPage className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">New request</h1>
        <p className="text-sm text-muted-foreground">Paid for something yourself? Get it paid back.</p>
      </div>
      <Busy label="Loading the form" className="space-y-5">
        <FieldsSkeleton count={4} />
      </Busy>
    </NarrowPage>
  );
}

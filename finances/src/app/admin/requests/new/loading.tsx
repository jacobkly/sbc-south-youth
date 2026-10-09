import { Busy, FieldsSkeleton } from "@/components/loading/page-skeletons";
import { NarrowPage } from "@/components/nav/app-shell";

export default function NewRequestLoading() {
  return (
    <NarrowPage className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">New request</h1>
      <Busy label="Loading the form" className="space-y-5">
        <FieldsSkeleton count={5} />
      </Busy>
    </NarrowPage>
  );
}

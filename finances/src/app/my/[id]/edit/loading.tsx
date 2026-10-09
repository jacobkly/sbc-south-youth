import { EditRequestSkeleton } from "@/components/loading/page-skeletons";
import { NarrowPage } from "@/components/nav/app-shell";

export default function EditMyRequestLoading() {
  return (
    <NarrowPage>
      <EditRequestSkeleton />
    </NarrowPage>
  );
}

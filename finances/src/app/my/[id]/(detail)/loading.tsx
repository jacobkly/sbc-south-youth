import { RequestDetailSkeleton } from "@/components/loading/page-skeletons";

// In a group of its own, so it also shows when coming back from editing it.
export default function MyRequestLoading() {
  return <RequestDetailSkeleton backHref="/my" backLabel="My requests" />;
}

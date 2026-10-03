import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MyRequestsNotFound() {
  return (
    <div className="space-y-4 py-10 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
      <p className="text-muted-foreground">This request doesn&apos;t exist, or it was deleted.</p>
      <Button asChild className="h-11 px-5">
        <Link href="/my">Go to My requests</Link>
      </Button>
    </div>
  );
}

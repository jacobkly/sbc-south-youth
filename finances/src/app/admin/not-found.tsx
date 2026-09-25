import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminNotFound() {
  return (
    <div className="space-y-4 py-10 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
      <p className="text-muted-foreground">This page doesn&rsquo;t exist, or it was deleted.</p>
      <Button asChild className="h-11 px-5">
        <Link href="/admin">Go to the dashboard</Link>
      </Button>
    </div>
  );
}

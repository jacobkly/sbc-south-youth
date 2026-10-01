import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/portal/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function PortalNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">This page doesn&apos;t exist or was moved.</p>
      </div>
      <Button asChild className="h-11 px-6">
        <Link href="/">Go to the portal home</Link>
      </Button>
    </main>
  );
}

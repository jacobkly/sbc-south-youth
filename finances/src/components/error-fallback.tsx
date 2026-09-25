"use client";

import { useEffect } from "react";
import { CircleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Fallback for route error boundaries. Server error details stay on the server. */
export function ErrorFallback({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-center gap-4 px-4 py-16 text-center">
      <CircleAlertIcon className="size-8 text-destructive" aria-hidden />
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          This screen couldn&apos;t load. Check your connection and try again.
        </p>
      </div>
      <Button className="h-11 px-6" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon } from "lucide-react";
import { Button } from "@/components/portal/ui/button";

/**
 * Loads the screen's data again. The portal on a home screen has no reload
 * button, so a section that couldn't load offers this instead.
 */
export function RetryButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 px-5"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending && <LoaderCircleIcon className="animate-spin" aria-hidden />}
      Try again
    </Button>
  );
}

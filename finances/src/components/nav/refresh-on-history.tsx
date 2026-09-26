"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Back and forward show a page as it was left, from Next's cache, so a
 * change made since (like an edit) wouldn't show. This refetches the page
 * right after, and it updates in place without losing the scroll spot.
 */
export function RefreshOnHistory() {
  const router = useRouter();

  useEffect(() => {
    // After Next's own popstate handler, so the refresh is for the page being returned to.
    const onPopState = () => setTimeout(() => router.refresh(), 0);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [router]);

  return null;
}

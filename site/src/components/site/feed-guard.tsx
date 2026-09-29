"use client";

import { useEffect } from "react";
import { FEED_ID, refreshFeed } from "@/lib/feed-dom";

/**
 * Reruns the feed check after a client-side navigation, every minute,
 * and when the tab comes back, so an announcement that expires while the
 * page is open disappears too.
 */
export function FeedGuard() {
  useEffect(() => {
    const run = () => refreshFeed(document.getElementById(FEED_ID));
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    run();
    const timer = window.setInterval(run, 60_000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}

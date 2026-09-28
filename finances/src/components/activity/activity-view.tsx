"use client";

import { useOptimistic, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ActivityFeedSkeleton } from "@/components/activity/activity-feed";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ACTIVITY_KIND_LABELS,
  ACTIVITY_KINDS,
  activityHref,
  type ActivityFilters,
  type ActivityKind,
} from "@/lib/activity/feed";

/**
 * The activity page's kind tabs and "Load more". The kind lives in the URL,
 * and the server renders the feed as `children`. This shows each change
 * right away while the next feed loads.
 */
export function ActivityView({
  filters,
  hasMore,
  capped,
  children,
}: {
  filters: ActivityFilters;
  hasMore: boolean;
  /** The newest events filled every page there is, so older ones can't be shown. */
  capped: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(filters);

  function navigate(next: ActivityFilters) {
    startTransition(() => {
      setShown(next);
      router.replace(activityHref(next), { scroll: false });
    });
  }

  const switchingKind = shown.kind !== filters.kind;
  const loadingMore = pending && !switchingKind && shown.pages > filters.pages;

  return (
    <Tabs value={shown.kind} onValueChange={(value) => navigate({ kind: value as ActivityKind, pages: 1 })}>
      {/* Wraps onto more rows instead of scrolling sideways, so every tab stays in reach on a phone. */}
      <TabsList className="w-full flex-wrap justify-start gap-2 bg-transparent p-0 group-data-horizontal/tabs:h-auto">
        {ACTIVITY_KINDS.map((kind) => (
          <TabsTrigger
            key={kind}
            value={kind}
            className="h-10 flex-none rounded-full border-border px-3.5 text-foreground data-active:border-primary data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none dark:text-foreground dark:data-active:border-primary dark:data-active:bg-primary dark:data-active:text-primary-foreground"
          >
            {ACTIVITY_KIND_LABELS[kind]}
          </TabsTrigger>
        ))}
      </TabsList>
      {ACTIVITY_KINDS.map((kind) => (
        <TabsContent key={kind} value={kind} aria-busy={pending} className="mt-2 space-y-3">
          {switchingKind ? (
            <ActivityFeedSkeleton />
          ) : (
            <>
              {children}
              {capped && (
                <p className="text-center text-sm text-muted-foreground">
                  Showing the newest activity only. Older activity is on each request&apos;s page.
                </p>
              )}
              {hasMore && (
                <Button
                  variant="outline"
                  className="h-11 w-full @4xl/main:mx-auto @4xl/main:flex @4xl/main:w-auto @4xl/main:px-8"
                  disabled={loadingMore}
                  onClick={() => navigate({ ...shown, pages: shown.pages + 1 })}
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </Button>
              )}
            </>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

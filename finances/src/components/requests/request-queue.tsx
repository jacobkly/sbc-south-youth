"use client";

import { useEffect, useEffectEvent, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { ActiveFilters, FilterSheet, type PayeeOption } from "@/components/requests/request-filters";
import { EmptyQueue, RequestList, RequestListSkeleton } from "@/components/requests/request-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { QueuePage } from "@/lib/requests/queries";
import {
  isFiltered,
  MAX_QUEUE_PAGES,
  QUEUE_PAGE_SIZE,
  QUEUE_TAB_LABELS,
  QUEUE_TAB_STATUSES,
  QUEUE_TABS,
  queueHref,
  sortsByPurchaseDate,
  type QueueTab,
  type ShownQueueFilters,
} from "@/lib/requests/queue";

const SEARCH_DELAY_MS = 300;

/**
 * The requests queue. The tab, search, and filters live in the URL, so the
 * back button and shared links bring back the same view. The server loads
 * the rows; this shows each change right away while they load.
 */
export function RequestQueue({
  filters,
  rows,
  counts,
  hasMore,
  payees,
  canCreate,
}: Omit<QueuePage, "tab"> & { filters: ShownQueueFilters; payees: PayeeOption[]; canCreate: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(filters);
  const [query, setQuery] = useState(filters.q);
  const [loadedQuery, setLoadedQuery] = useState(filters.q);
  const searchRef = useRef<HTMLInputElement>(null);

  // The search can change without typing, like tapping Requests in the nav.
  // Show it in the box, unless the user has typed something newer.
  if (filters.q !== loadedQuery) {
    setLoadedQuery(filters.q);
    if (query.trim() === loadedQuery) setQuery(filters.q);
  }

  function navigate(next: ShownQueueFilters) {
    startTransition(() => {
      setShown(next);
      router.replace(queueHref(next), { scroll: false });
    });
  }

  /** Any change to what's listed starts again from the first page. */
  function update(changes: Partial<ShownQueueFilters>) {
    navigate({ ...shown, ...changes, pages: 1 });
  }

  function clearFilters() {
    setQuery("");
    update({ q: "", from: null, to: null, type: null, payee: null, missingReceipt: false });
  }

  const searchIfChanged = useEffectEvent((text: string) => {
    if (text.trim() !== shown.q) update({ q: text.trim() });
  });

  // Search once typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => searchIfChanged(query), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const switchingTab = shown.tab !== filters.tab;
  const loadingMore = pending && !switchingTab && shown.pages > filters.pages;
  const refreshing = pending && !switchingTab && !loadingMore;
  const total = counts[filters.tab];
  const capped = !hasMore && total > rows.length && filters.pages >= MAX_QUEUE_PAGES;

  let content;
  if (switchingTab) {
    content = <RequestListSkeleton />;
  } else if (rows.length === 0) {
    content = (
      <EmptyQueue
        tab={filters.tab}
        filtered={isFiltered(filters)}
        noRequests={counts.all === 0}
        canCreate={canCreate}
        onClearFilters={clearFilters}
      />
    );
  } else {
    content = (
      <div className="space-y-3">
        <RequestList
          rows={rows}
          showStatus={QUEUE_TAB_STATUSES[filters.tab]?.length !== 1}
          byPurchaseDate={sortsByPurchaseDate(filters)}
        />
        {(hasMore || capped) && (
          <p className="text-center text-sm text-muted-foreground">
            {capped
              ? `Showing the newest ${rows.length.toLocaleString()}. Narrow the filters to see older ones.`
              : `Showing ${rows.length.toLocaleString()} of ${total.toLocaleString()}.`}
          </p>
        )}
        {hasMore && (
          <Button
            variant="outline"
            className="h-11 w-full @4xl/main:mx-auto @4xl/main:flex @4xl/main:w-auto @4xl/main:px-8"
            disabled={loadingMore}
            onClick={() => navigate({ ...shown, pages: shown.pages + 1 })}
          >
            {loadingMore ? "Loading…" : `Load ${Math.min(QUEUE_PAGE_SIZE, total - rows.length)} more`}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Requests</h1>

      <div className="space-y-3">
        <div className="flex gap-2">
          <form
            role="search"
            className="relative min-w-0 flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              if (query.trim() !== shown.q) update({ q: query.trim() });
              // Closes the keyboard on phones so the results are in view.
              searchRef.current?.blur();
            }}
          >
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={searchRef}
              type="search"
              enterKeyHint="search"
              aria-label="Search requests"
              placeholder="Search requests"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={100}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 pr-11 pl-9 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1/2 right-1 size-9 -translate-y-1/2 text-muted-foreground"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  if (shown.q) update({ q: "" });
                  searchRef.current?.focus();
                }}
              >
                <XIcon />
              </Button>
            )}
          </form>
          <FilterSheet filters={shown} payees={payees} onApply={update} />
        </div>
        <ActiveFilters filters={shown} payees={payees} onRemove={update} />
      </div>

      <Tabs value={shown.tab} onValueChange={(value) => update({ tab: value as QueueTab })}>
        {/* Wraps onto more rows instead of scrolling sideways, so every tab stays in reach on a phone. */}
        <TabsList className="w-full flex-wrap justify-start gap-2 bg-transparent p-0 group-data-horizontal/tabs:h-auto">
          {QUEUE_TABS.map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="h-10 flex-none gap-2 rounded-full border-border px-3.5 text-foreground data-active:border-primary data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none dark:text-foreground dark:data-active:border-primary dark:data-active:bg-primary dark:data-active:text-primary-foreground"
            >
              {QUEUE_TAB_LABELS[tab]}
              <span className="text-xs font-normal tabular-nums opacity-70">{counts[tab]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {QUEUE_TABS.map((tab) => (
          <TabsContent
            key={tab}
            value={tab}
            aria-busy={pending}
            className={cn("mt-2 transition-opacity", refreshing && "opacity-60")}
          >
            {content}
          </TabsContent>
        ))}
      </Tabs>

      <p className="sr-only" role="status">
        {pending ? "" : `${total} ${total === 1 ? "request" : "requests"}`}
      </p>
    </div>
  );
}

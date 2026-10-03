"use client";

import { useOptimistic, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, HistoryIcon, SearchXIcon } from "lucide-react";
import { cn } from "cn";
import { ActivityFeed } from "@/components/portal/activity/activity-feed";
import { ActivityFeedSkeleton } from "@/components/portal/activity/activity-skeleton";
import { Button } from "@/components/portal/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/portal/ui/dropdown-menu";
import type { DayView } from "@/lib/portal/activity/feed";
import {
  activityHref,
  DEFAULT_ACTIVITY_FILTERS,
  kindLabel,
  kindsFor,
  SCOPE_LABELS,
  withScope,
  type ActivityFilters,
  type ActivityKind,
  type ActivityScope,
} from "@/lib/portal/activity/filters";

/** Someone the person filter offers. */
export type ActivityPerson = { id: string; label: string };

/**
 * The Activity screen's filters, feed, and "Load more". The filters live in
 * the URL and the server loads the feed for them. This shows each change
 * right away, with a placeholder feed while the next one loads.
 */
export function ActivityView({
  filters,
  visible,
  people,
  days,
  hasMore,
  capped,
}: {
  filters: ActivityFilters;
  /** The apps this person's roles show. */
  visible: ActivityScope[];
  people: ActivityPerson[];
  days: DayView[];
  hasMore: boolean;
  /** The newest events filled every page there is, so older ones can't be shown. */
  capped: boolean;
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

  const clear = () => navigate(DEFAULT_ACTIVITY_FILTERS);
  const switching = shown.scope !== filters.scope || shown.person !== filters.person || shown.kind !== filters.kind;
  const loadingMore = pending && !switching && shown.pages > filters.pages;
  const filtered = shown.scope !== "all" || shown.person !== null || shown.kind !== "all";
  const kinds = kindsFor(visible, shown.scope);
  const personLabel = shown.person
    ? (people.find((person) => person.id === shown.person)?.label ?? "Someone")
    : "Anyone";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
        {visible.length > 1 && (
          <FilterMenu
            label="App"
            value={shown.scope === "all" ? "All apps" : SCOPE_LABELS[shown.scope]}
            active={shown.scope !== "all"}
            options={[
              { value: "all", label: "All apps" },
              ...visible.map((scope) => ({ value: scope, label: SCOPE_LABELS[scope] })),
            ]}
            selected={shown.scope}
            onSelect={(value) => navigate(withScope(shown, value as ActivityFilters["scope"]))}
          />
        )}
        <FilterMenu
          label="Person"
          value={personLabel}
          active={shown.person !== null}
          options={[{ value: "", label: "Anyone" }, ...people.map(({ id, label }) => ({ value: id, label }))]}
          selected={shown.person ?? ""}
          onSelect={(value) => navigate({ ...shown, person: value || null, pages: 1 })}
        />
        {kinds.length > 0 && (
          <FilterMenu
            label="Action"
            value={shown.kind === "all" ? "All actions" : kindLabel(shown.kind)}
            active={shown.kind !== "all"}
            options={[
              { value: "all", label: "All actions" },
              ...kinds.map((kind) => ({ value: kind, label: kindLabel(kind) })),
            ]}
            selected={shown.kind}
            onSelect={(value) => navigate({ ...shown, kind: value as ActivityKind | "all", pages: 1 })}
          />
        )}
        {filtered && (
          <Button variant="ghost" className="h-10 rounded-full px-3.5" onClick={clear}>
            Clear
          </Button>
        )}
      </div>

      <div aria-busy={pending} className="space-y-4">
        {switching ? (
          <ActivityFeedSkeleton />
        ) : days.length === 0 ? (
          <EmptyActivity filtered={filtered} visible={visible} onClear={clear} />
        ) : (
          <>
            <ActivityFeed days={days} showScope={visible.length > 1 && shown.scope === "all"} />
            {capped && (
              <p className="text-center text-sm text-balance text-muted-foreground">
                Showing the newest 1,000 events. Pick a person or action to see older ones.
              </p>
            )}
            {hasMore && (
              <Button
                variant="outline"
                className="h-11 w-full sm:mx-auto sm:flex sm:w-auto sm:px-8"
                disabled={loadingMore}
                onClick={() => navigate({ ...shown, pages: shown.pages + 1 })}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** A filter as a pill that opens its choices. It stands out once something's picked. */
function FilterMenu({
  label,
  value,
  active,
  options,
  selected,
  onSelect,
}: {
  label: string;
  value: string;
  active: boolean;
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const [first, ...rest] = options;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={active ? "default" : "outline"}
          className={cn("h-10 max-w-full rounded-full px-3.5", !active && "bg-card")}
          aria-label={`${label}: ${value}`}
        >
          <span className="truncate">{value}</span>
          <ChevronDownIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-auto max-w-[calc(100vw-2rem)] min-w-48">
        <DropdownMenuRadioGroup value={selected} onValueChange={onSelect}>
          <DropdownMenuRadioItem value={first.value} className="min-h-10">
            {first.label}
          </DropdownMenuRadioItem>
          {rest.length > 0 && <DropdownMenuSeparator />}
          {rest.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} className="min-h-10">
              <span className="truncate">{option.label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const EMPTY_SCOPE_TEXT: Record<ActivityScope, string> = {
  site: "Changes to the site's posts, events, photos, and messages will show up here.",
  finances: "Anything done to a request shows up here.",
  platform: "Invites, role changes, and sign-ins show up here.",
};

function EmptyActivity({
  filtered,
  visible,
  onClear,
}: {
  filtered: boolean;
  visible: ActivityScope[];
  onClear: () => void;
}) {
  let body: ReactNode;
  if (filtered) {
    body = (
      <>
        <SearchXIcon className="mx-auto size-6 text-muted-foreground" aria-hidden />
        <p className="font-semibold">Nothing matches these filters</p>
        <Button variant="outline" className="h-11 px-5" onClick={onClear}>
          Clear filters
        </Button>
      </>
    );
  } else {
    body = (
      <>
        <HistoryIcon className="mx-auto size-6 text-muted-foreground" aria-hidden />
        <div className="space-y-1">
          <p className="font-semibold">No activity yet</p>
          <p className="text-sm text-balance text-muted-foreground">
            {visible.length === 1 ? EMPTY_SCOPE_TEXT[visible[0]] : "Changes leaders make show up here."}
          </p>
        </div>
      </>
    );
  }
  return <div className="space-y-3 rounded-xl border border-dashed p-6 text-center">{body}</div>;
}

"use client";

import { useSyncExternalStore, type MouseEvent } from "react";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { findBackTarget, pageLabel, type BackTarget } from "@/lib/navigation";

/** The parts of the Navigation API this uses, which TypeScript's DOM types don't have yet. */
type HistoryNavigation = EventTarget & {
  currentEntry: { index: number } | null;
  entries(): { url: string | null }[];
};

function historyNavigation(): HistoryNavigation | undefined {
  return (window as Window & { navigation?: HistoryNavigation }).navigation;
}

function currentTarget(): BackTarget | null {
  const navigation = historyNavigation();
  const index = navigation?.currentEntry?.index ?? -1;
  if (!navigation || index < 0) return null;
  return findBackTarget(
    navigation.entries().map((entry) => entry.url),
    index,
  );
}

// Next writes the new history entry just after a page renders, so this
// listens for it rather than trusting the first read.
function subscribe(onChange: () => void) {
  const navigation = historyNavigation();
  navigation?.addEventListener("currententrychange", onChange);
  return () => navigation?.removeEventListener("currententrychange", onChange);
}

function previousHref(): string | null {
  return currentTarget()?.href ?? null;
}

function goBack(event: MouseEvent<HTMLAnchorElement>) {
  // Modified clicks open the link in a new tab instead.
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = currentTarget();
  if (!target) return;
  event.preventDefault();
  window.history.go(-target.steps);
}

/**
 * Goes back to the page you came from when it's in the app, like the
 * dashboard or a report, at the same scroll spot. Otherwise, as when the
 * page was opened from a link or the browser lacks the Navigation API,
 * it's a link to `fallbackHref`.
 */
export function BackLink({ fallbackHref, fallbackLabel }: { fallbackHref: string; fallbackLabel: string }) {
  const previous = useSyncExternalStore(subscribe, previousHref, () => null);
  const href = previous ?? fallbackHref;
  const label = previous ? pageLabel(previous.split("?")[0]) : fallbackLabel;

  return (
    <Button variant="ghost" className="-ml-3 h-11 px-3 text-muted-foreground" asChild>
      <Link href={href} onClick={goBack} aria-label={label === "Back" ? undefined : `Back to ${label}`}>
        <ChevronLeftIcon aria-hidden />
        {label}
      </Link>
    </Button>
  );
}

"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import { parseAudience, type AudienceFilter } from "@/lib/audience";
import { FEED_ID } from "@/lib/feed-dom";

type Key = "all" | AudienceFilter;

// The active look comes from `data-for` on the feed, so it's right from
// the first paint, before this component hydrates.
const chips: { key: Key; label: string; status: string; active: string }[] = [
  {
    key: "all",
    label: "All",
    status: "Showing everything",
    active: "group-data-[for=all]/feed:bg-accent group-data-[for=all]/feed:text-on-accent group-data-[for=all]/feed:ring-transparent",
  },
  {
    key: "hs",
    label: "High school",
    status: "Showing high school and everyone",
    active: "group-data-[for=hs]/feed:bg-accent group-data-[for=hs]/feed:text-on-accent group-data-[for=hs]/feed:ring-transparent",
  },
  {
    key: "college",
    label: "College",
    status: "Showing college and everyone",
    active:
      "group-data-[for=college]/feed:bg-accent group-data-[for=college]/feed:text-on-accent group-data-[for=college]/feed:ring-transparent",
  },
];

function ChipList({
  path,
  active,
  status = "",
  onSelect,
}: {
  path: string;
  active: Key | null;
  status?: string;
  onSelect?: (event: MouseEvent<HTMLAnchorElement>, key: Key, href: string) => void;
}) {
  return (
    <div role="group" aria-label="Show what's for">
      <ul className="flex gap-2">
        {chips.map((chip) => {
          const href = chip.key === "all" ? path : `${path}?for=${chip.key}`;
          return (
            <li key={chip.key}>
              <a
                href={href}
                aria-current={active === chip.key ? "true" : undefined}
                onClick={onSelect && ((event) => onSelect(event, chip.key, href))}
                className={`pressable inline-flex h-10 items-center rounded-full bg-surface px-4 text-small font-semibold whitespace-nowrap ring-1 ring-line-strong ring-inset hover:bg-surface-2 ${chip.active}`}
              >
                {chip.label}
              </a>
            </li>
          );
        })}
      </ul>
      <p aria-live="polite" className="sr-only">
        {status}
      </p>
    </div>
  );
}

/**
 * All, High school, and College. The choice lives in `?for=`, so a
 * filtered link can be shared. Picking one swaps the URL in place, and
 * CSS does the filtering.
 */
export function AudienceChips({ path }: { path: string }) {
  const active: Key = parseAudience(useSearchParams().getAll("for")) ?? "all";
  const [status, setStatus] = useState("");

  useEffect(() => {
    document.getElementById(FEED_ID)?.setAttribute("data-for", active);
  }, [active]);

  function select(event: MouseEvent<HTMLAnchorElement>, key: Key, href: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.history.replaceState(null, "", href);
    setStatus(chips.find((chip) => chip.key === key)?.status ?? "");
  }

  return <ChipList path={path} active={active} status={status} onSelect={select} />;
}

/** The same chips before the URL is known. They work as plain links. */
export function AudienceChipsFallback({ path }: { path: string }) {
  return <ChipList path={path} active={null} />;
}

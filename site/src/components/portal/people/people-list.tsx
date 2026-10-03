"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRightIcon, SearchIcon } from "lucide-react";
import { UserAvatar } from "@/components/portal/nav/user-avatar";
import { Badge } from "@/components/portal/ui/badge";
import { Input } from "@/components/portal/ui/input";
import { searchPeople, STATUS_LABELS, STATUS_VARIANTS, type Person } from "@/lib/portal/people/list";
import { ROLE_LABELS } from "@/lib/portal/roles";

const ROW =
  "flex min-w-0 items-start gap-3 p-4 outline-none hover:bg-muted/50 " +
  "focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset";

/** Search only helps once there are a few people to look through. */
const SEARCH_FROM = 6;

/** Everyone with an account, each opening their page, with a search once the list grows. */
export function PeopleList({ people }: { people: Person[] }) {
  const [query, setQuery] = useState("");
  const shown = searchPeople(people, query);
  const searching = query.trim() !== "";

  return (
    <div className="space-y-4">
      {people.length >= SEARCH_FROM && (
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            aria-label="Search people"
            aria-describedby="people-count"
            placeholder="Search by name, email, or role"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="h-11 pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      )}

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          No one matches &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card" aria-label="People">
          {shown.map((person) => (
            <li key={person.id}>
              <PersonRow person={person} />
            </li>
          ))}
        </ul>
      )}

      <p id="people-count" className="sr-only" aria-live="polite">
        {searching ? `${shown.length} of ${people.length} people` : `${people.length} people`}
      </p>
    </div>
  );
}

function PersonRow({ person }: { person: Person }) {
  const status = person.status === "active" ? null : person.status;
  return (
    <Link href={`/people/${person.id}`} className={ROW}>
      <UserAvatar name={person.name} path={person.avatarPath} className="mt-0.5 size-10" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="min-w-0">
          <p className="flex min-w-0 items-baseline gap-1.5 font-medium">
            <span className="truncate">{person.name}</span>
            {person.you && <span className="shrink-0 text-sm font-normal text-muted-foreground">(you)</span>}
          </p>
          <p className="truncate text-sm text-muted-foreground">{person.email}</p>
          <p className="text-xs text-muted-foreground">{person.seen}</p>
        </div>
        {(status || person.roles.length > 0) && (
          <p className="flex flex-wrap gap-1.5">
            {status && <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>}
            {person.roles.map((role) => (
              <Badge key={role} variant="secondary">
                {ROLE_LABELS[role]}
              </Badge>
            ))}
          </p>
        )}
      </div>
      <ChevronRightIcon className="mt-2.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

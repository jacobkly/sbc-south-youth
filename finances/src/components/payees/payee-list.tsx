"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownUpIcon, ChevronDownIcon, ChevronRightIcon, PlusIcon, SearchIcon } from "lucide-react";
import { PayeeSheet } from "@/components/payees/payee-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCents } from "@/lib/money";
import type { PayeeListRow } from "@/lib/payees/columns";
import { payeeMatches, payeeSearchNeedle } from "@/lib/payees/search";
import { PAYEE_SORTS, payeesHref, sortPayees, type PayeeSort } from "@/lib/payees/sort";
import { cn } from "@/lib/utils";

type StatusFilter = "active" | "inactive";

/**
 * Payees with search, a sort, and an active/inactive filter. There are few
 * enough payees to filter and sort in the browser, which keeps it instant.
 * The sort lives in the URL, so coming back from a payee keeps it. Each row
 * shows what the payee was paid this year and opens their page.
 */
export function PayeeList({
  payees,
  sort,
  canEdit,
  yearTotals,
  year,
}: {
  payees: PayeeListRow[];
  sort: PayeeSort;
  canEdit: boolean;
  /** Cents paid to each payee id during `year`. */
  yearTotals: Record<string, number>;
  year: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [shownSort, setShownSort] = useOptimistic(sort);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [adding, setAdding] = useState(false);

  // Through the router, not history.replaceState, so a refresh after going back doesn't scroll to the top.
  function changeSort(next: PayeeSort) {
    startTransition(() => {
      setShownSort(next);
      router.replace(payeesHref(next), { scroll: false });
    });
  }

  const needle = payeeSearchNeedle(query);
  const sorted = sortPayees(payees, shownSort, yearTotals);
  const byStatus = {
    active: sorted.filter((payee) => payee.is_active),
    inactive: sorted.filter((payee) => !payee.is_active),
  };

  function renderList(filter: StatusFilter) {
    const visible = byStatus[filter].filter((payee) => payeeMatches(payee, needle));

    if (visible.length === 0) {
      return (
        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {needle ? (
            <p>No {filter} payees match &ldquo;{query.trim()}&rdquo;.</p>
          ) : filter === "inactive" ? (
            <p>No inactive payees.</p>
          ) : (
            <div className="space-y-3">
              <p>No payees yet.</p>
              {canEdit && (
                <Button className="h-11 px-5" onClick={() => setAdding(true)}>
                  <PlusIcon />
                  Add the first payee
                </Button>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <>
        <div className="flex items-center justify-between gap-3">
          <SortMenu sort={shownSort} year={year} onChange={changeSort} />
          {/* Screen readers get the year on each amount instead. */}
          <p className="pr-11 text-xs text-muted-foreground" aria-hidden>
            Paid in {year}
          </p>
        </div>
        <ul className="divide-y rounded-lg border">
          {visible.map((payee) => {
            const details = [payee.payment_handle, payee.email].filter(Boolean).join(" · ");
            const paid = yearTotals[payee.id] ?? 0;

            return (
              <li key={payee.id}>
                <Link
                  href={`/admin/payees/${payee.id}`}
                  className="flex min-h-16 items-center gap-3 px-4 py-3 outline-none hover:bg-muted focus-visible:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{payee.full_name}</p>
                    {/* The badge sits on this line so the name gets the full width on a phone. */}
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      {payee.user_id && <Badge variant="secondary">Has account</Badge>}
                      <span className="truncate">{details || "No contact info"}</span>
                    </p>
                  </div>
                  <span className={cn("shrink-0 text-sm tabular-nums", paid === 0 && "text-muted-foreground")}>
                    {formatCents(paid)}
                    <span className="sr-only"> paid in {year}</span>
                  </span>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Payees</h1>
        {canEdit && (
          <Button className="h-10 px-4" onClick={() => setAdding(true)}>
            <PlusIcon />
            Add payee
          </Button>
        )}
      </div>

      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          aria-label="Search payees"
          placeholder="Search name, email, or handle"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-11 pl-9"
        />
      </div>

      <Tabs value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
        <TabsList className="w-full group-data-horizontal/tabs:h-10">
          <TabsTrigger value="active">Active ({byStatus.active.length})</TabsTrigger>
          <TabsTrigger value="inactive">Inactive ({byStatus.inactive.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-2">
          {renderList("active")}
        </TabsContent>
        <TabsContent value="inactive" className="mt-2">
          {renderList("inactive")}
        </TabsContent>
      </Tabs>

      {canEdit && <PayeeSheet payee={adding ? "new" : null} onClose={() => setAdding(false)} />}
    </div>
  );
}

const SORT_LABELS: Record<PayeeSort, string> = {
  name: "Name",
  paid: "Most paid",
  newest: "Newest",
};

/** Picks the list's order. The button shows the current one. */
function SortMenu({ sort, year, onChange }: { sort: PayeeSort; year: number; onChange: (sort: PayeeSort) => void }) {
  const hints: Record<PayeeSort, string> = {
    name: "A to Z",
    paid: `Paid in ${year}, most first`,
    newest: "Most recently added first",
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="-ml-3 h-11 gap-1.5 px-3 text-muted-foreground">
          <ArrowDownUpIcon aria-hidden />
          <span className="sr-only">Sort by </span>
          {SORT_LABELS[sort]}
          <ChevronDownIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-60">
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={sort} onValueChange={(value) => onChange(value as PayeeSort)}>
          {PAYEE_SORTS.map((option) => (
            <DropdownMenuRadioItem key={option} value={option} className="min-h-11 py-2">
              <span>
                <span className="block">{SORT_LABELS[option]}</span>
                <span className="block text-xs text-muted-foreground">{hints[option]}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { useEffect, useEffectEvent, useOptimistic, useState, useTransition } from "react";
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
import { PAYEE_SORTS, sortPayees, type PayeeSort } from "@/lib/payees/sort";
import { payeesHref, type PayeeStatus, type PayeeView } from "@/lib/payees/view";
import { cn } from "@/lib/utils";

/** Name, payment handle, email, paid this year, and the chevron, once the list is wide. */
const COLUMNS = "@4xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1.25fr)_8rem_1rem] @4xl:gap-4";

const SEARCH_DELAY_MS = 300;

/**
 * Payees with search, a sort, and an active/inactive filter. There are few
 * enough payees to filter and sort in the browser, which keeps it instant.
 * The tab, search, and sort live in the URL, so coming back from a payee
 * keeps them. Each row shows what the payee was paid this year and opens
 * their page.
 */
export function PayeeList({
  payees,
  view,
  canEdit,
  yearTotals,
  year,
}: {
  payees: PayeeListRow[];
  view: PayeeView;
  canEdit: boolean;
  /** Cents paid to each payee id during `year`. */
  yearTotals: Record<string, number>;
  year: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(view);
  const [query, setQuery] = useState(view.q);
  const [loadedQuery, setLoadedQuery] = useState(view.q);
  const [adding, setAdding] = useState(false);

  // The search can change without typing, like tapping Payees in the nav.
  // Show it in the box, unless the user has typed something newer.
  if (view.q !== loadedQuery) {
    setLoadedQuery(view.q);
    if (query.trim() === loadedQuery) setQuery(view.q);
  }

  // Through the router, not history.replaceState, so a refresh after going back doesn't scroll to the top.
  function navigate(changes: Partial<PayeeView>) {
    const next = { ...shown, ...changes };
    startTransition(() => {
      setShown(next);
      router.replace(payeesHref(next), { scroll: false });
    });
  }

  const searchIfChanged = useEffectEvent((text: string) => {
    if (text.trim() !== shown.q) navigate({ q: text.trim() });
  });

  // The list filters as you type. The URL catches up once typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => searchIfChanged(query), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const needle = payeeSearchNeedle(query);
  const sorted = sortPayees(payees, shown.sort, yearTotals);
  const byStatus = {
    active: sorted.filter((payee) => payee.is_active),
    inactive: sorted.filter((payee) => !payee.is_active),
  };

  function renderList(filter: PayeeStatus) {
    const visible = byStatus[filter].filter((payee) => payeeMatches(payee, needle));

    if (visible.length === 0) {
      return (
        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {needle ? (
            <p>No {filter} payees match &ldquo;{query.trim()}&rdquo;.</p>
          ) : filter === "inactive" ? (
            <p>No inactive payees.</p>
          ) : byStatus.inactive.length > 0 ? (
            <p>No active payees.</p>
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
      <div className="@container">
        <div className="flex items-center justify-between gap-3">
          <SortMenu sort={shown.sort} year={year} onChange={(sort) => navigate({ sort })} />
          {/* Screen readers get the year on each amount instead. A wide list has it in its header. */}
          <p className="pr-11 text-xs text-muted-foreground @4xl:hidden" aria-hidden>
            Paid in {year}
          </p>
        </div>
        <div className="overflow-hidden rounded-lg border">
          <div
            aria-hidden
            className={cn(COLUMNS, "hidden border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground @4xl:grid")}
          >
            <span>Name</span>
            <span>Payment handle</span>
            <span>Email</span>
            <span className="text-right">Paid in {year}</span>
          </div>
          <ul className="divide-y">
            {visible.map((payee) => {
              const details = [payee.payment_handle, payee.email].filter(Boolean).join(" · ");
              const paid = yearTotals[payee.id] ?? 0;
              const account = payee.user_id && <Badge variant="secondary">Has account</Badge>;

              return (
                <li key={payee.id}>
                  <Link
                    href={`/admin/payees/${payee.id}`}
                    className={cn(
                      COLUMNS,
                      "flex min-h-16 items-center gap-3 px-4 py-3 outline-none hover:bg-muted focus-visible:bg-muted @4xl:grid @4xl:min-h-0",
                    )}
                  >
                    <div className="min-w-0 flex-1 @4xl:hidden">
                      <p className="truncate font-medium">{payee.full_name}</p>
                      {/* The badge sits on this line so the name gets the full width on a phone. */}
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        {account}
                        <span className="truncate">{details || "No contact info"}</span>
                      </p>
                    </div>
                    <span className="hidden min-w-0 items-center gap-2 @4xl:flex">
                      <span className="truncate font-medium">{payee.full_name}</span>
                      {account}
                    </span>
                    <Detail value={payee.payment_handle} missing="No payment handle" />
                    <Detail value={payee.email} missing="No email" />
                    <span
                      className={cn("shrink-0 text-right text-sm tabular-nums", paid === 0 && "text-muted-foreground")}
                    >
                      {formatCents(paid)}
                      <span className="sr-only"> paid in {year}</span>
                    </span>
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
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

      <Tabs value={shown.status} onValueChange={(value) => navigate({ status: value as PayeeStatus })}>
        {/* Stacked on a phone, and one toolbar row on a PC. */}
        <div className="space-y-4 @4xl/main:flex @4xl/main:items-center @4xl/main:gap-4 @4xl/main:space-y-0">
          <div className="relative @4xl/main:w-96">
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
          <TabsList className="w-full group-data-horizontal/tabs:h-10 @4xl/main:w-72 @4xl/main:group-data-horizontal/tabs:h-11">
            <TabsTrigger value="active">Active ({byStatus.active.length})</TabsTrigger>
            <TabsTrigger value="inactive">Inactive ({byStatus.inactive.length})</TabsTrigger>
          </TabsList>
        </div>
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

/** A contact detail in a wide list, or a dash when there isn't one. */
function Detail({ value, missing }: { value: string | null; missing: string }) {
  return (
    <span className="hidden truncate text-muted-foreground @4xl:block">
      {value || (
        <>
          <span aria-hidden>—</span>
          <span className="sr-only">{missing}</span>
        </>
      )}
    </span>
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

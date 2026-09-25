"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRightIcon, PlusIcon, SearchIcon } from "lucide-react";
import { PayeeSheet } from "@/components/payees/payee-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCents } from "@/lib/money";
import type { PayeeRow } from "@/lib/payees/columns";
import { payeeMatches, payeeSearchNeedle } from "@/lib/payees/search";
import { cn } from "@/lib/utils";

type StatusFilter = "active" | "inactive";

/**
 * Payees with search and an active/inactive filter. There are few enough
 * payees to filter in the browser, which keeps search instant as you type.
 * Each row shows what the payee was paid this year and opens their page.
 */
export function PayeeList({
  payees,
  canEdit,
  yearTotals,
  year,
}: {
  payees: PayeeRow[];
  canEdit: boolean;
  /** Cents paid to each payee id during `year`. */
  yearTotals: Record<string, number>;
  year: number;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [adding, setAdding] = useState(false);

  const needle = payeeSearchNeedle(query);
  const byStatus = {
    active: payees.filter((payee) => payee.is_active),
    inactive: payees.filter((payee) => !payee.is_active),
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
        {/* Screen readers get the year on each amount instead. */}
        <p className="mb-1 pr-11 text-right text-xs text-muted-foreground" aria-hidden>
          Paid in {year}
        </p>
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

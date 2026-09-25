"use client";

import { useState } from "react";
import { ChevronRightIcon, PlusIcon, SearchIcon } from "lucide-react";
import { PayeeSheet } from "@/components/payees/payee-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PayeeRow } from "@/lib/payees/columns";

type StatusFilter = "active" | "inactive";

function matches(payee: PayeeRow, needle: string): boolean {
  return [payee.full_name, payee.email, payee.payment_handle].some((value) =>
    value?.toLowerCase().includes(needle),
  );
}

/**
 * Payees with search and an active/inactive filter. There are few enough
 * payees to filter in the browser, which keeps search instant as you type.
 */
export function PayeeList({ payees, canEdit }: { payees: PayeeRow[]; canEdit: boolean }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [editing, setEditing] = useState<PayeeRow | "new" | null>(null);

  const needle = query.trim().toLowerCase();
  const byStatus = {
    active: payees.filter((payee) => payee.is_active),
    inactive: payees.filter((payee) => !payee.is_active),
  };

  function renderList(filter: StatusFilter) {
    const visible = needle ? byStatus[filter].filter((payee) => matches(payee, needle)) : byStatus[filter];

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
                <Button className="h-11 px-5" onClick={() => setEditing("new")}>
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
      <ul className="divide-y rounded-lg border">
        {visible.map((payee) => {
          const details = [payee.payment_handle, payee.email].filter(Boolean).join(" · ");
          const content = (
            <>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium">
                  <span className="truncate">{payee.full_name}</span>
                  {payee.user_id && <Badge variant="secondary">Has account</Badge>}
                </p>
                <p className="truncate text-sm text-muted-foreground">{details || "No contact info"}</p>
              </div>
              {canEdit && <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
            </>
          );

          return (
            <li key={payee.id}>
              {canEdit ? (
                <button
                  type="button"
                  className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left outline-none hover:bg-muted focus-visible:bg-muted"
                  aria-label={`Edit ${payee.full_name}`}
                  onClick={() => setEditing(payee)}
                >
                  {content}
                </button>
              ) : (
                <div className="flex min-h-16 items-center gap-3 px-4 py-3">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Payees</h1>
        {canEdit && (
          <Button className="h-10 px-4" onClick={() => setEditing("new")}>
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

      {canEdit && <PayeeSheet payee={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

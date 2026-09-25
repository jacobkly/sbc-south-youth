import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { StatusBadge } from "@/components/requests/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { formatRequestNumber } from "@/lib/requests/format";
import type { QueueRow } from "@/lib/requests/queries";
import type { QueueTab } from "@/lib/requests/queue";

/** Requests as tappable cards, each linking to its detail page. */
export function RequestList({ rows, showStatus }: { rows: QueueRow[]; showStatus: boolean }) {
  return (
    <ul className="divide-y rounded-lg border">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/admin/requests/${row.id}`}
            className="flex min-h-16 items-start gap-3 px-4 py-3 outline-none hover:bg-muted focus-visible:bg-muted"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{row.payee?.full_name ?? "Unknown payee"}</p>
              <p className="truncate text-sm text-muted-foreground">{row.vendor}</p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {formatRequestNumber(row.request_number)} · {formatDate(row.purchase_date)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-medium tabular-nums">{formatCents(row.amount_cents)}</span>
              {showStatus && <StatusBadge status={row.status} />}
              {row.no_receipt && <Badge variant="outline">No receipt</Badge>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function RequestListSkeleton() {
  return (
    <div className="divide-y rounded-lg border" aria-busy="true" aria-label="Loading requests">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex min-h-16 items-start gap-3 px-4 py-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

const EMPTY_TAB_MESSAGES: Record<QueueTab, string> = {
  review: "Nothing is waiting for review.",
  info: "No requests need more info.",
  pay: "Nothing is waiting to be paid.",
  paid: "No paid requests yet.",
  closed: "No rejected or cancelled requests.",
  all: "No requests yet.",
};

export function EmptyQueue({
  tab,
  filtered,
  noRequests,
  canCreate,
  onClearFilters,
}: {
  tab: QueueTab;
  /** A search or filter is on. */
  filtered: boolean;
  /** There are no requests at all yet. */
  noRequests: boolean;
  canCreate: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
      {filtered ? (
        <>
          <p>No requests here match your search and filters.</p>
          <Button variant="outline" className="h-11 px-5" onClick={onClearFilters}>
            Clear filters
          </Button>
        </>
      ) : noRequests ? (
        <>
          <p>No requests yet.</p>
          {canCreate && (
            <Button className="h-11 px-5" asChild>
              <Link href="/admin/requests/new">
                <PlusIcon aria-hidden />
                Enter the first request
              </Link>
            </Button>
          )}
        </>
      ) : (
        <p>{EMPTY_TAB_MESSAGES[tab]}</p>
      )}
    </div>
  );
}

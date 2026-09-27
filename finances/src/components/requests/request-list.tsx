import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { cn } from "cn";
import { StatusBadge } from "@/components/requests/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, type IsoDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { formatRequestNumber, REQUEST_TYPE_LABELS, requestTitle } from "@/lib/requests/format";
import type { QueueRow } from "@/lib/requests/queries";
import type { QueueTab } from "@/lib/requests/queue";

/** Which optional columns a list shows. */
type Shown = { showPayee: boolean; showStatus: boolean };

/**
 * The columns a wide list shows, as a `grid-template-columns` value. The
 * header and every row share it through a CSS variable, so they line up.
 */
function columnTemplate({ showPayee, showStatus }: Shown): string {
  return [
    "6.5rem", // Date
    "4.5rem", // Number
    showPayee && "minmax(0,1fr)",
    showPayee ? "minmax(0,1.5fr)" : "minmax(0,1fr)", // Purchase
    "4rem", // Type
    showStatus && "7rem",
    "6.5rem", // Amount
  ]
    .filter(Boolean)
    .join(" ");
}

const COLUMNS = "@4xl:grid-cols-(--request-columns) items-center gap-4";

/**
 * The frame for a list of requests: stacked cards on a phone or in a narrow
 * column, and a row of columns under a header once the list itself is wide.
 */
export function RequestTable({
  id,
  showPayee,
  showStatus,
  dateLabel = "Date",
  className,
  children,
}: Shown & {
  /** Goes on the list, for aria-controls. */
  id?: string;
  dateLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("@container overflow-hidden rounded-lg border", className)}
      style={{ "--request-columns": columnTemplate({ showPayee, showStatus }) } as CSSProperties}
    >
      {/* Screen readers get each row as one link instead. */}
      <div
        aria-hidden
        className={cn(COLUMNS, "hidden border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground @4xl:grid")}
      >
        <span>{dateLabel}</span>
        <span>No.</span>
        {showPayee && <span>Payee</span>}
        <span>Purchase</span>
        <span>Type</span>
        {showStatus && <span>Status</span>}
        <span className="text-right">Amount</span>
      </div>
      <ul id={id} className="divide-y">
        {children}
      </ul>
    </div>
  );
}

/**
 * One request in a RequestTable, linking to its page. `children` is the
 * stacked card; a wide list shows `date` and the rest in columns instead.
 */
export function RequestRow({
  row,
  date,
  showPayee,
  showStatus,
  children,
}: Shown & { row: QueueRow; date: IsoDate; children: ReactNode }) {
  return (
    <li>
      <Link
        href={`/admin/requests/${row.id}`}
        className="block min-h-16 px-4 py-3 outline-none hover:bg-muted focus-visible:bg-muted @4xl:min-h-0"
      >
        <div className="flex items-start gap-3 @4xl:hidden">{children}</div>
        <div className={cn(COLUMNS, "hidden text-sm @4xl:grid")}>
          <span className="tabular-nums">{formatDate(date)}</span>
          <span className="text-muted-foreground tabular-nums">{formatRequestNumber(row.request_number)}</span>
          {showPayee && <span className="truncate font-medium">{row.payee?.full_name ?? "Unknown payee"}</span>}
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn("truncate", !showPayee && "font-medium")}>{requestTitle(row)}</span>
            {row.no_receipt && <Badge variant="outline">No receipt</Badge>}
          </span>
          <span className="text-muted-foreground">{REQUEST_TYPE_LABELS[row.type]}</span>
          {showStatus && (
            <span className="flex">
              <StatusBadge status={row.status} />
            </span>
          )}
          <span className="text-right font-medium tabular-nums">{formatCents(row.amount_cents)}</span>
        </div>
      </Link>
    </li>
  );
}

/** Requests by purchase date. Leave out the payee on a page that's already about one payee. */
export function RequestList({
  rows,
  showStatus,
  showPayee = true,
  className,
}: {
  rows: QueueRow[];
  showStatus: boolean;
  showPayee?: boolean;
  className?: string;
}) {
  return (
    <RequestTable showPayee={showPayee} showStatus={showStatus} className={className}>
      {rows.map((row) => (
        <RequestRow key={row.id} row={row} date={row.purchase_date} showPayee={showPayee} showStatus={showStatus}>
          <div className="min-w-0 flex-1">
            {showPayee ? (
              <>
                <p className="truncate font-medium">{row.payee?.full_name ?? "Unknown payee"}</p>
                <p className="truncate text-sm text-muted-foreground">{requestTitle(row)}</p>
              </>
            ) : (
              <p className="truncate font-medium">{requestTitle(row)}</p>
            )}
            <p className="text-sm text-muted-foreground tabular-nums">
              {formatRequestNumber(row.request_number)} · {formatDate(row.purchase_date)}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="font-medium tabular-nums">{formatCents(row.amount_cents)}</span>
            {showStatus && <StatusBadge status={row.status} />}
            {row.no_receipt && <Badge variant="outline">No receipt</Badge>}
          </div>
        </RequestRow>
      ))}
    </RequestTable>
  );
}

export function RequestListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading requests">
      <RequestTable showPayee showStatus>
        {[0, 1, 2].map((index) => (
          <li key={index} className="min-h-16 px-4 py-3 @4xl:min-h-0">
            <div className="flex items-start gap-3 @4xl:hidden">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-36" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
            <div className={cn(COLUMNS, "hidden h-5 @4xl:grid")}>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          </li>
        ))}
      </RequestTable>
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

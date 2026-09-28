import Link from "next/link";
import {
  BanIcon,
  BanknoteIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  CircleXIcon,
  FilePlusIcon,
  FileSpreadsheetIcon,
  MessageCircleQuestionMarkIcon,
  PaperclipIcon,
  PencilIcon,
  SendIcon,
  Undo2Icon,
  type LucideIcon,
} from "lucide-react";
import { EventDetails } from "@/components/requests/event-details";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { itemTitle, leadEvent, type ActivityDay, type ActivityItem, type ActivityKind } from "@/lib/activity/feed";
import type { ActivityEvent } from "@/lib/activity/queries";
import { formatTime } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { formatRequestNumber, requestTitle } from "@/lib/requests/format";
import type { EventAction } from "@/lib/requests/status";

const ACTION_ICONS: Record<EventAction, LucideIcon> = {
  created: FilePlusIcon,
  updated: PencilIcon,
  submitted: SendIcon,
  approved: CircleCheckIcon,
  recorded_paid: BanknoteIcon,
  info_requested: MessageCircleQuestionMarkIcon,
  rejected: CircleXIcon,
  cancelled: BanIcon,
  unapproved: Undo2Icon,
  paid: BanknoteIcon,
  unpaid: Undo2Icon,
  receipt_added: PaperclipIcon,
  receipt_removed: PaperclipIcon,
};

function ItemIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span
      aria-hidden
      className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border bg-background text-muted-foreground"
    >
      <Icon className="size-4" />
    </span>
  );
}

/** The item's headline, with the time it happened on the right. */
function ItemHeading({ item }: { item: ActivityItem<ActivityEvent> }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="min-w-0 font-medium">{itemTitle(item)}</p>
      <time dateTime={item.created_at} className="shrink-0 text-sm text-muted-foreground tabular-nums">
        {formatTime(item.created_at)}
      </time>
    </div>
  );
}

/** Who did it, left out when it was the person looking. */
function Actor({ event, currentUserId }: { event: ActivityEvent; currentUserId: string | null }) {
  if (!event.actor || event.actor_id === currentUserId) return null;
  return <p className="text-sm text-muted-foreground">by {event.actor.full_name}</p>;
}

/** "R-0012 · Jane Doe · $12.00 · Costco" */
function requestLine(request: ActivityEvent["request"]): string {
  return [
    formatRequestNumber(request.request_number),
    request.payee?.full_name ?? "Unknown payee",
    formatCents(request.amount_cents),
    requestTitle(request),
  ].join(" · ");
}

/** One request's events close together, linking to the request. */
function RequestItem({
  item,
  payeeNames,
  currentUserId,
}: {
  item: ActivityItem<ActivityEvent>;
  payeeNames: ReadonlyMap<string, string>;
  currentUserId: string | null;
}) {
  const lead = leadEvent(item.events);
  const { request } = lead;
  return (
    <li>
      <Link
        href={`/admin/requests/${request.id}`}
        className="flex items-start gap-3 px-4 py-3 outline-none hover:bg-muted focus-visible:bg-muted"
      >
        <ItemIcon icon={ACTION_ICONS[lead.action as EventAction] ?? PencilIcon} />
        <div className="min-w-0 flex-1 space-y-1">
          <ItemHeading item={item} />
          <p className="truncate text-sm text-muted-foreground">{requestLine(request)}</p>
          {item.events.map((event) => (
            <EventDetails key={event.id} event={event} payeeNames={payeeNames} />
          ))}
          <Actor event={lead} currentUserId={currentUserId} />
        </div>
      </Link>
    </li>
  );
}

/** Many requests changed at once, like an import, with the requests folded away. */
function BulkItem({ item, currentUserId }: { item: ActivityItem<ActivityEvent>; currentUserId: string | null }) {
  const requests = [...new Map(item.events.map((event) => [event.request.id, event.request])).values()].sort(
    (a, b) => a.request_number - b.request_number,
  );
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <ItemIcon icon={FileSpreadsheetIcon} />
      <div className="min-w-0 flex-1 space-y-1">
        <ItemHeading item={item} />
        <Actor event={item.events[0]} currentUserId={currentUserId} />
        <details className="group">
          <summary className="-mx-2 flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-2 text-sm font-medium outline-none hover:bg-muted focus-visible:bg-muted [&::-webkit-details-marker]:hidden">
            Show the {requests.length} requests
            <ChevronDownIcon className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="space-y-1 pt-1 text-sm">
            {requests.map((request) => (
              <li key={request.id}>
                <Link
                  href={`/admin/requests/${request.id}`}
                  className="-mx-2 block truncate rounded-md px-2 py-1.5 outline-none hover:bg-muted focus-visible:bg-muted"
                >
                  {requestLine(request)}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </li>
  );
}

/** Items under a heading for each day, newest first. */
export function ActivityFeed({
  days,
  payeeNames,
  currentUserId,
}: {
  days: ActivityDay<ActivityItem<ActivityEvent>>[];
  payeeNames: ReadonlyMap<string, string>;
  currentUserId: string | null;
}) {
  return (
    <div className="space-y-6">
      {days.map((day) => (
        <section key={day.date} aria-labelledby={`day-${day.date}`} className="space-y-2">
          <h2 id={`day-${day.date}`} className="text-sm font-medium text-muted-foreground">
            {day.label}
          </h2>
          <ul className="divide-y overflow-hidden rounded-lg border">
            {day.items.map((item) =>
              item.type === "bulk" ? (
                <BulkItem key={item.key} item={item} currentUserId={currentUserId} />
              ) : (
                <RequestItem key={item.key} item={item} payeeNames={payeeNames} currentUserId={currentUserId} />
              ),
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ActivityFeedSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading activity">
      <Skeleton className="h-4 w-20" />
      <ul className="divide-y overflow-hidden rounded-lg border">
        {[0, 1, 2, 3].map((index) => (
          <li key={index} className="flex items-start gap-3 px-4 py-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-14" />
              </div>
              <Skeleton className="h-4 w-48" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const EMPTY_MESSAGES: Record<ActivityKind, string> = {
  all: "No activity yet. Anything done to a request shows up here.",
  receipts: "No files added or removed yet.",
  payments: "No payments yet.",
  status: "No status changes yet.",
  edits: "No requests created or edited yet.",
};

export function EmptyActivity({ kind }: { kind: ActivityKind }) {
  return (
    <div className="space-y-3 rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
      <p>{EMPTY_MESSAGES[kind]}</p>
      {kind !== "all" && (
        <Button variant="outline" className="h-11 px-5" asChild>
          <Link href="/admin/activity">Show all activity</Link>
        </Button>
      )}
    </div>
  );
}

import Link from "next/link";
import { BanknoteIcon, ChevronRightIcon, CircleCheckIcon, InboxIcon, MessageCircleQuestionMarkIcon } from "lucide-react";
import { cn } from "cn";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSummary, StatusTotal } from "@/lib/dashboard/summary";
import { formatCents } from "@/lib/money";
import { DEFAULT_QUEUE_FILTERS, queueHref, type QueueTab } from "@/lib/requests/queue";

function requestCount(count: number): string {
  return count === 1 ? "1 request" : `${count} requests`;
}

type Row = {
  tab: QueueTab;
  label: string;
  total: StatusTotal;
  icon: typeof InboxIcon;
  /** Matches the status badge colors. */
  tint: string;
};

/** One queue tab: what it holds and how much, opening the tab. */
function ActionRow({ tab, label, total, icon: Icon, tint }: Row) {
  const empty = total.count === 0;
  return (
    <li>
      <Link
        href={queueHref({ ...DEFAULT_QUEUE_FILTERS, tab })}
        className="flex min-h-16 items-center gap-3 px-4 py-3 outline-none hover:bg-muted focus-visible:bg-muted"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            empty ? "bg-muted text-muted-foreground" : tint,
          )}
        >
          <Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{label}</span>
          <span className="block text-sm text-muted-foreground">
            {empty ? "Nothing waiting" : requestCount(total.count)}
          </span>
        </span>
        {!empty && <span className="text-lg font-semibold tabular-nums">{formatCents(total.cents)}</span>}
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

/** What's waiting on the finance leader, most urgent first, or that nothing is. */
export function NeedsAction({ summary }: { summary: DashboardSummary }) {
  const { toPay, awaitingReview, needsInfo } = summary;
  const rows: Row[] = [
    {
      tab: "pay",
      label: "To pay",
      total: toPay,
      icon: BanknoteIcon,
      tint: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
    },
    {
      tab: "review",
      label: "To review",
      total: awaitingReview,
      icon: InboxIcon,
      tint: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
    },
  ];
  // Only shows up when a request is waiting on more info.
  if (needsInfo.count > 0) {
    rows.push({
      tab: "info",
      label: "Needs info",
      total: needsInfo,
      icon: MessageCircleQuestionMarkIcon,
      tint: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    });
  }
  const caughtUp = rows.every((row) => row.total.count === 0);

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle>
          <h2>Needs action</h2>
        </CardTitle>
        {caughtUp && <CardDescription>Nothing to review or pay.</CardDescription>}
      </CardHeader>
      {caughtUp ? (
        <div className="flex items-center gap-3 px-4 py-4">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
          >
            <CircleCheckIcon className="size-5" />
          </span>
          <p className="font-medium">All caught up</p>
        </div>
      ) : (
        <ul className="divide-y">
          {rows.map((row) => (
            <ActionRow key={row.tab} {...row} />
          ))}
        </ul>
      )}
    </Card>
  );
}

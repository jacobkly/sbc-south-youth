import Link from "next/link";
import { RequestList } from "@/components/requests/request-list";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { QueueRow } from "@/lib/requests/queries";
import { DEFAULT_QUEUE_FILTERS, queueHref } from "@/lib/requests/queue";

/** The newest requests by purchase date, any status. */
export function LatestRequests({ rows }: { rows: QueueRow[] }) {
  return (
    <Card className="min-w-0 gap-0 pb-0">
      <CardHeader className="border-b">
        <CardTitle>
          <h2>Latest requests</h2>
        </CardTitle>
        <CardDescription>Newest purchases first</CardDescription>
        <CardAction>
          <Link
            href={queueHref({ ...DEFAULT_QUEUE_FILTERS, tab: "all" })}
            className="-mr-2 inline-flex h-11 items-center rounded-md px-2 text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            View all
          </Link>
        </CardAction>
      </CardHeader>
      <RequestList rows={rows} showStatus className="rounded-none border-0" />
    </Card>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { NarrowPage } from "@/components/nav/app-shell";
import { NotLinked } from "@/components/requests/not-linked";
import { RequestList } from "@/components/requests/request-list";
import { Button } from "@/components/ui/button";
import { getCurrentPayeeId } from "@/lib/auth/current-user";
import { groupMyRequests } from "@/lib/requests/mine";
import { loadPayeeRequests } from "@/lib/requests/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "My requests",
};

/** Their newest requests. Plenty for a requester, who sends a handful a month. */
const LIMIT = 100;

export default async function MyRequestsPage() {
  const payeeId = await getCurrentPayeeId();
  if (!payeeId) return <NotLinked title="My requests" />;

  const supabase = await createClient();
  // Handled by my/error.tsx.
  const { rows, total } = await loadPayeeRequests(supabase, payeeId, LIMIT);
  const { toFinish, sent } = groupMyRequests(rows);

  return (
    <NarrowPage className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">My requests</h1>
        {rows.length > 0 && (
          <Button className="h-11" asChild>
            <Link href="/my/new">
              <PlusIcon aria-hidden />
              New request
            </Link>
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="space-y-4 rounded-lg border border-dashed px-4 py-10 text-center">
          <div className="space-y-1">
            <p className="font-medium">No requests yet</p>
            <p className="text-sm text-muted-foreground">
              Paid for something for youth? Add it with a photo of the receipt to get paid back.
            </p>
          </div>
          <Button className="h-11 px-5" asChild>
            <Link href="/my/new">
              <PlusIcon aria-hidden />
              New request
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {toFinish.length > 0 && (
            <section aria-labelledby="to-finish-heading" className="space-y-3">
              <div className="space-y-1">
                <h2 id="to-finish-heading" className="text-lg font-semibold">
                  To finish
                </h2>
                <p className="text-sm text-muted-foreground">
                  Drafts, and requests an owner asked about. Open one to finish it and send it.
                </p>
              </div>
              <RequestList rows={toFinish} showStatus showPayee={false} basePath="/my" />
            </section>
          )}

          {sent.length > 0 && (
            <section aria-labelledby="sent-heading" className="space-y-3">
              <h2 id="sent-heading" className="text-lg font-semibold">
                Sent
              </h2>
              <RequestList rows={sent} showStatus showPayee={false} basePath="/my" />
            </section>
          )}

          {total > rows.length && (
            <p className="text-sm text-muted-foreground">
              Showing your newest {rows.length} of {total} requests.
            </p>
          )}
        </>
      )}
    </NarrowPage>
  );
}

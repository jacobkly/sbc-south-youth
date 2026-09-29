import type { ReactNode } from "react";
import Link from "next/link";
import { BackLink } from "@/components/nav/back-link";
import { RequestList } from "@/components/requests/request-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/money";
import type { PayeeRow } from "@/lib/payees/columns";
import type { PayeeTotals } from "@/lib/payees/totals";
import type { QueueRow } from "@/lib/requests/queries";
import { cn } from "@/lib/utils";

function Stat({ label, cents, note, className }: { label: string; cents: number; note?: string; className?: string }) {
  return (
    <div className={cn("space-y-1 rounded-lg border px-4 py-3", className)}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{formatCents(cents)}</dd>
      {note && <dd className="text-sm text-muted-foreground">{note}</dd>}
    </div>
  );
}

/** A payee's totals, contact details, and newest requests. */
export function PayeeDetail({
  payee,
  totals,
  year,
  requests,
  totalRequests,
  allRequestsHref,
  actions,
}: {
  payee: PayeeRow;
  totals: PayeeTotals;
  year: number;
  /** Newest first. */
  requests: QueueRow[];
  /** All of the payee's requests, which can be more than are shown. */
  totalRequests: number;
  /** The queue filtered to this payee. */
  allRequestsHref: string;
  /** Shown beside the name. Left out for anyone who can only view. */
  actions?: ReactNode;
}) {
  const details: [string, ReactNode][] = [];
  if (payee.email) {
    details.push([
      "Email",
      <a key="email" href={`mailto:${payee.email}`} className="underline underline-offset-4">
        {payee.email}
      </a>,
    ]);
  }
  if (payee.payment_handle) details.push(["Payment handle", payee.payment_handle]);
  if (payee.notes) details.push(["Notes", payee.notes]);

  const waiting = totals.toPayCount === 1 ? "1 request" : `${totals.toPayCount} requests`;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <BackLink fallbackHref="/admin/payees" fallbackLabel="Payees" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight break-words">{payee.full_name}</h1>
            {(!payee.is_active || payee.user_id) && (
              <div className="flex flex-wrap gap-2">
                {!payee.is_active && <Badge variant="outline">Inactive</Badge>}
                {payee.user_id && <Badge variant="secondary">Has account</Badge>}
              </div>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      </div>

      {/* On a PC the totals and details sit side by side, above the full-width requests. */}
      <div className="space-y-6 @4xl/main:grid @4xl/main:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @4xl/main:items-start @4xl/main:gap-6 @4xl/main:space-y-0">
        <section aria-labelledby="totals-heading" className="@4xl/main:space-y-3">
          {/* A phone leaves it out, since the totals sit right under the name. */}
          <h2 id="totals-heading" className="sr-only text-lg font-semibold @4xl/main:not-sr-only">
            Totals
          </h2>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat label={`Paid in ${year}`} cents={totals.paidInYear} />
            <Stat label="Paid all time" cents={totals.paidAllTime} />
            <Stat
              label="To pay"
              cents={totals.toPay}
              note={totals.toPayCount > 0 ? waiting : undefined}
              className="col-span-2 md:col-span-1"
            />
          </dl>
        </section>

        <section aria-labelledby="details-heading" className="space-y-3">
          <h2 id="details-heading" className="text-lg font-semibold">
            Details
          </h2>
          {details.length > 0 ? (
            <dl className="divide-y rounded-lg border">
              {details.map(([term, value]) => (
                <div key={term} className="space-y-1 px-4 py-3">
                  <dt className="text-sm text-muted-foreground">{term}</dt>
                  <dd className="break-words whitespace-pre-wrap">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-muted-foreground">No contact info.</p>
          )}
        </section>
      </div>

      <section aria-labelledby="requests-heading" className="space-y-3">
        <h2 id="requests-heading" className="text-lg font-semibold">
          Requests
        </h2>
        {requests.length > 0 ? (
          <>
            <RequestList rows={requests} showStatus showPayee={false} />
            {totalRequests > requests.length && (
              <Button
                variant="outline"
                className="h-11 w-full md:w-auto md:px-5 @4xl/main:mx-auto @4xl/main:flex @4xl/main:w-fit @4xl/main:px-8"
                asChild
              >
                <Link href={allRequestsHref}>See all {totalRequests} requests</Link>
              </Button>
            )}
          </>
        ) : (
          <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            <p>No requests for this payee yet.</p>
          </div>
        )}
      </section>
    </div>
  );
}

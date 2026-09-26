import Link from "next/link";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PayeeTotal } from "@/lib/dashboard/summary";
import { periodLabel, type Period } from "@/lib/dates";
import { formatCents } from "@/lib/money";

function payeeCount(count: number): string {
  return count === 1 ? "1 active payee" : `${count} active payees`;
}

/** Who was paid the most this year, as bars against the top payee. */
export function TopPayees({ payees, period, activePayees }: { payees: PayeeTotal[]; period: Period; activePayees: number }) {
  const most = payees[0]?.cents ?? 0;

  return (
    <Card className="min-w-0 gap-0 pb-0">
      <CardHeader className="border-b">
        <CardTitle>
          <h2>Top payees</h2>
        </CardTitle>
        <CardDescription>
          Paid in {periodLabel(period)} · {payeeCount(activePayees)}
        </CardDescription>
        <CardAction>
          <Link
            href="/admin/payees"
            className="-mr-2 inline-flex h-11 items-center rounded-md px-2 text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            All payees
          </Link>
        </CardAction>
      </CardHeader>
      {payees.length > 0 ? (
        <ol className="divide-y">
          {payees.map((payee) => (
            <li key={payee.id}>
              <Link
                href={`/admin/payees/${payee.id}`}
                className="block space-y-2 px-4 py-3 outline-none hover:bg-muted focus-visible:bg-muted"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">{payee.name}</span>
                  <span className="shrink-0 font-medium tabular-nums">{formatCents(payee.cents)}</span>
                </span>
                <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${most > 0 ? Math.max(2, (payee.cents / most) * 100) : 0}%` }}
                  />
                </span>
                <span className="block text-xs text-muted-foreground">
                  {payee.count === 1 ? "1 request" : `${payee.count} requests`}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nobody has been paid in {periodLabel(period)} yet.
        </CardContent>
      )}
    </Card>
  );
}

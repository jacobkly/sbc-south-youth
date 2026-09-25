import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { formatRequestNumber, REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS } from "@/lib/requests/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Request",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function receiptSummary(request: {
  no_receipt: boolean;
  no_receipt_reason: string | null;
  receipts: { count: number }[];
}): string {
  if (request.no_receipt) return `None on file: ${request.no_receipt_reason}`;
  const count = request.receipts[0]?.count ?? 0;
  if (count === 0) return "None yet";
  return count === 1 ? "1 file" : `${count} files`;
}

export default async function RequestPage({ params }: PageProps<"/admin/requests/[id]">) {
  const { id } = await params;
  // A malformed id would be a database error, not a missing request.
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: request, error } = await supabase
    .from("reimbursement_requests")
    .select(
      "request_number, status, type, amount_cents, purchase_date, vendor, description, event_name, no_receipt, no_receipt_reason, payee:payees(full_name), receipts(count)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error; // handled by admin/error.tsx
  if (!request) notFound();

  const details: [string, string][] = [
    ["Type", REQUEST_TYPE_LABELS[request.type]],
    ["Purchase date", formatDate(request.purchase_date)],
    ["Vendor", request.vendor],
    ...(request.event_name ? ([["Event", request.event_name]] as [string, string][]) : []),
    ["Description", request.description],
    ["Receipts", receiptSummary(request)],
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{formatRequestNumber(request.request_number)}</span>
          <Badge variant="secondary">{REQUEST_STATUS_LABELS[request.status]}</Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight tabular-nums">{formatCents(request.amount_cents)}</h1>
        <p className="text-lg">{request.payee?.full_name}</p>
      </div>

      <dl className="divide-y rounded-lg border">
        {details.map(([term, value]) => (
          <div key={term} className="space-y-1 px-4 py-3">
            <dt className="text-sm text-muted-foreground">{term}</dt>
            <dd className="break-words whitespace-pre-wrap">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

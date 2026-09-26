import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { RequestStatus } from "@/lib/requests/format";

/** A saved request that already has a receipt with the same file. */
export type ReceiptMatch = {
  requestId: string;
  requestNumber: number;
  status: RequestStatus;
  payeeName: string | null;
  amountCents: number;
  /** The request being edited, rather than another one. */
  current: boolean;
};

export type ReceiptMatchRow = {
  request: {
    id: string;
    request_number: number;
    status: RequestStatus;
    amount_cents: number;
    payee: { full_name: string } | null;
  } | null;
};

/**
 * One match per request, even if it has the file twice: the request being
 * edited first, then the newest.
 */
export function receiptMatches(rows: readonly ReceiptMatchRow[], currentRequestId?: string): ReceiptMatch[] {
  const matches = new Map<string, ReceiptMatch>();
  for (const { request } of rows) {
    if (!request || matches.has(request.id)) continue;
    matches.set(request.id, {
      requestId: request.id,
      requestNumber: request.request_number,
      status: request.status,
      payeeName: request.payee?.full_name ?? null,
      amountCents: request.amount_cents,
      current: request.id === currentRequestId,
    });
  }
  return Array.from(matches.values()).sort(
    (a, b) => Number(b.current) - Number(a.current) || b.requestNumber - a.requestNumber,
  );
}

/**
 * Saved requests with a receipt whose file hashes the same as `sha256`.
 * Admins can read every request, so this finds them all.
 */
export async function findReceiptMatches(
  supabase: SupabaseClient<Database>,
  sha256: string,
  currentRequestId?: string,
): Promise<ReceiptMatch[]> {
  const { data, error } = await supabase
    .from("receipts")
    .select("request:reimbursement_requests(id, request_number, status, amount_cents, payee:payees(full_name))")
    .eq("sha256", sha256)
    .limit(20);
  if (error) throw error;
  return receiptMatches(data, currentRequestId);
}

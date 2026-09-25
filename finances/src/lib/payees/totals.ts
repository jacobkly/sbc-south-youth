import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database.types";
import { laDateOf, laMidnight } from "@/lib/dates";
import { fetchAll } from "@/lib/supabase/fetch-all";

type TotalsRow = Pick<Tables<"reimbursement_requests">, "status" | "amount_cents" | "paid_at">;

export type PayeeTotals = {
  /** Paid during the year, by the LA date it was paid. */
  paidInYear: number;
  paidAllTime: number;
  /** Approved and not paid yet. */
  toPay: number;
  toPayCount: number;
};

/** Totals in cents for one payee's approved and paid requests. Other statuses are ignored. */
export function payeeTotals(rows: readonly TotalsRow[], year: number): PayeeTotals {
  const totals: PayeeTotals = { paidInYear: 0, paidAllTime: 0, toPay: 0, toPayCount: 0 };
  for (const row of rows) {
    if (row.status === "approved") {
      totals.toPay += row.amount_cents;
      totals.toPayCount += 1;
    } else if (row.status === "paid") {
      totals.paidAllTime += row.amount_cents;
      if (row.paid_at && laDateOf(row.paid_at).startsWith(`${year}-`)) totals.paidInYear += row.amount_cents;
    }
  }
  return totals;
}

/** Cents per payee id. Payees with nothing are left out. */
export function sumByPayee(rows: readonly { payee_id: string; amount_cents: number }[]): Record<string, number> {
  const sums: Record<string, number> = {};
  for (const row of rows) sums[row.payee_id] = (sums[row.payee_id] ?? 0) + row.amount_cents;
  return sums;
}

/** The first and last-plus-one instants of a year in LA, for a paid_at range. */
function yearBounds(year: number): { start: string; end: string } {
  return {
    start: laMidnight(`${year}-01-01`).toISOString(),
    end: laMidnight(`${year + 1}-01-01`).toISOString(),
  };
}

/** One payee's totals. Throws if a query fails. */
export async function loadPayeeTotals(
  supabase: SupabaseClient<Database>,
  payeeId: string,
  year: number,
): Promise<PayeeTotals> {
  const rows = await fetchAll((from, to) =>
    supabase
      .from("reimbursement_requests")
      .select("status, amount_cents, paid_at")
      .eq("payee_id", payeeId)
      .in("status", ["approved", "paid"])
      .order("id")
      .range(from, to),
  );
  return payeeTotals(rows, year);
}

/** Cents paid to each payee during the year, by the LA date paid. Throws if a query fails. */
export async function loadYearTotals(supabase: SupabaseClient<Database>, year: number): Promise<Record<string, number>> {
  const { start, end } = yearBounds(year);
  const rows = await fetchAll((from, to) =>
    supabase
      .from("reimbursement_requests")
      .select("payee_id, amount_cents")
      .eq("status", "paid")
      .gte("paid_at", start)
      .lt("paid_at", end)
      .order("id")
      .range(from, to),
  );
  return sumByPayee(rows);
}

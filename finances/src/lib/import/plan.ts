import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { IsoDate } from "@/lib/dates";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { nameKey, type ImportRow } from "./parse";

export type ExistingPayee = {
  id: string;
  full_name: string;
  user_id: string | null;
  is_active: boolean;
  created_at: string;
};

export type ExistingRequest = { payee_id: string; purchase_date: IsoDate; amount_cents: number };

export type ImportPlan = {
  /** Names of payees the import will add, in the order they first appear. */
  newPayees: string[];
  /** The payee name each row is saved under, by line number. */
  payeeNames: Map<number, string>;
  /** Line numbers of rows that match a request already in the app. */
  duplicates: Set<number>;
  /** Line numbers of rows paid to the signed-in admin. */
  selfRows: Set<number>;
};

export type MonthTotal = { month: string; cafe: number; youth: number; total: number; count: number };

/**
 * The payee each name will go to, picked the way import_paid_requests picks
 * one: active payees first, then the oldest.
 */
function payeesByName(payees: readonly ExistingPayee[]): Map<string, ExistingPayee> {
  const sorted = [...payees].sort(
    (a, b) => Number(b.is_active) - Number(a.is_active) || a.created_at.localeCompare(b.created_at),
  );
  const byName = new Map<string, ExistingPayee>();
  for (const payee of sorted) {
    const key = nameKey(payee.full_name);
    if (!byName.has(key)) byName.set(key, payee);
  }
  return byName;
}

function requestKey(payeeId: string, date: IsoDate, cents: number): string {
  return `${payeeId}|${date}|${cents}`;
}

/**
 * What the import will do. A row is a likely duplicate when a request for
 * the same payee, date, and amount is already in the app, so importing the
 * same spreadsheet twice doesn't count anything twice. Each request in the
 * app matches at most one row, so two real purchases that look alike are
 * only flagged as many times as the app already has them.
 */
export function planImport(
  rows: readonly ImportRow[],
  payees: readonly ExistingPayee[],
  existing: readonly ExistingRequest[],
  currentUserId: string,
): ImportPlan {
  const byName = payeesByName(payees);

  const unmatched = new Map<string, number>();
  for (const request of existing) {
    const key = requestKey(request.payee_id, request.purchase_date, request.amount_cents);
    unmatched.set(key, (unmatched.get(key) ?? 0) + 1);
  }

  const newPayees = new Map<string, string>();
  const payeeNames = new Map<number, string>();
  const duplicates = new Set<number>();
  const selfRows = new Set<number>();

  for (const row of rows) {
    const payee = byName.get(nameKey(row.name));
    if (!payee) {
      // A new payee is added with the spelling of its first row.
      const name = newPayees.get(nameKey(row.name)) ?? row.name;
      newPayees.set(nameKey(row.name), name);
      payeeNames.set(row.line, name);
      continue;
    }

    payeeNames.set(row.line, payee.full_name);

    if (payee.user_id === currentUserId) selfRows.add(row.line);

    const key = requestKey(payee.id, row.date, row.amount_cents);
    const left = unmatched.get(key) ?? 0;
    if (left > 0) {
      duplicates.add(row.line);
      unmatched.set(key, left - 1);
    }
  }

  return { newPayees: [...newPayees.values()], payeeNames, duplicates, selfRows };
}

/** Totals by month and type, oldest month first, to check against the spreadsheet. */
export function monthTotals(rows: readonly ImportRow[]): MonthTotal[] {
  const months = new Map<string, MonthTotal>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    const total = months.get(month) ?? { month, cafe: 0, youth: 0, total: 0, count: 0 };
    total[row.type] += row.amount_cents;
    total.total += row.amount_cents;
    total.count += 1;
    months.set(month, total);
  }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** Every payee, and the requests still open or paid in the import's date range, for planning. */
export async function loadImportContext(
  supabase: SupabaseClient<Database>,
  rows: readonly ImportRow[],
): Promise<{ payees: ExistingPayee[]; existing: ExistingRequest[] }> {
  const dates = rows.map((row) => row.date).sort();
  const [payees, existing] = await Promise.all([
    fetchAll((from, to) =>
      supabase.from("payees").select("id, full_name, user_id, is_active, created_at").order("id").range(from, to),
    ),
    dates.length === 0
      ? Promise.resolve([])
      : fetchAll((from, to) =>
          supabase
            .from("reimbursement_requests")
            .select("payee_id, purchase_date, amount_cents")
            .not("status", "in", "(rejected,cancelled)")
            .gte("purchase_date", dates[0])
            .lte("purchase_date", dates[dates.length - 1])
            .order("id")
            .range(from, to),
        ),
  ]);
  return { payees, existing };
}

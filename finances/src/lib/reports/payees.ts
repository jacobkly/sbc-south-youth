import { REQUEST_TYPES } from "@/lib/requests/schema";
import type { PayeeTotals, ReportTotals } from "./filters";

/** How many payees the Payees tab lists before adding up everyone else. */
export const TOP_PAYEES = 10;

/** Several payees added up, like "Everyone else". */
export type PayeeGroupTotals = ReportTotals & { payees: number };

function addUp(payees: readonly PayeeTotals[]): PayeeGroupTotals {
  const sum: PayeeGroupTotals = {
    payees: payees.length,
    cents: 0,
    count: 0,
    byType: Object.fromEntries(REQUEST_TYPES.map((type) => [type, { cents: 0, count: 0 }])) as ReportTotals["byType"],
  };
  for (const payee of payees) {
    sum.cents += payee.cents;
    sum.count += payee.count;
    for (const type of REQUEST_TYPES) {
      sum.byType[type].cents += payee.byType[type].cents;
      sum.byType[type].count += payee.byType[type].count;
    }
  }
  return sum;
}

/**
 * The top payees, in the order given, and everyone after them added up.
 * One payee past the limit shows on their own, since adding up one saves nothing.
 */
export function topPayees(
  payees: readonly PayeeTotals[],
  limit = TOP_PAYEES,
): { top: PayeeTotals[]; rest: PayeeGroupTotals | null } {
  if (payees.length <= limit + 1) return { top: [...payees], rest: null };
  return { top: payees.slice(0, limit), rest: addUp(payees.slice(limit)) };
}

/** The average amount per payee, to the cent, and how many requests each has on average. */
export function payeeAverage(payees: readonly PayeeTotals[]): { cents: number; requests: number } {
  if (payees.length === 0) return { cents: 0, requests: 0 };
  const { cents, count } = addUp(payees);
  return { cents: Math.round(cents / payees.length), requests: count / payees.length };
}

export type PayeeGroup = "new" | "returning";

export const PAYEE_GROUP_LABELS: Record<PayeeGroup, string> = {
  new: "New payees",
  returning: "Returning payees",
};

/** A group of payees: how many, their requests, and what they add up to. */
export type PayeeSlice = { key: PayeeGroup; payees: number; count: number; cents: number };

/**
 * Payees new to the report's filters, then those with a request before the
 * period. Both show, so nobody returning reads as zero.
 */
export function newPayeeBreakdown(payees: readonly PayeeTotals[], returning: ReadonlySet<string>): PayeeSlice[] {
  return (["new", "returning"] as const).map((key) => {
    const { payees: count, count: requests, cents } = addUp(
      payees.filter((payee) => returning.has(payee.payeeId) === (key === "returning")),
    );
    return { key, payees: count, count: requests, cents };
  });
}

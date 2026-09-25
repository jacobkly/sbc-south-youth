import type { PayeeRow } from "./columns";

/** Normalizes what the user typed so it can be passed to payeeMatches. */
export function payeeSearchNeedle(query: string): string {
  return query.trim().toLowerCase();
}

/** True when the payee's name, email, or payment handle contains the needle. */
export function payeeMatches(
  payee: Pick<PayeeRow, "full_name" | "email" | "payment_handle">,
  needle: string,
): boolean {
  if (!needle) return true;
  return [payee.full_name, payee.email, payee.payment_handle].some((value) =>
    value?.toLowerCase().includes(needle),
  );
}

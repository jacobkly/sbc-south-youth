import type { PayeeListRow } from "./columns";

export const PAYEE_SORTS = ["name", "paid", "newest"] as const;
export type PayeeSort = (typeof PAYEE_SORTS)[number];

/**
 * The payees in the chosen order: by name, by what they were paid, most
 * first, or by when they were added, newest first. Ties go by name.
 */
export function sortPayees<T extends Pick<PayeeListRow, "id" | "full_name" | "created_at">>(
  payees: readonly T[],
  sort: PayeeSort,
  /** Cents paid to each payee id. */
  paid: Readonly<Record<string, number>>,
): T[] {
  const byName = (a: T, b: T) => a.full_name.localeCompare(b.full_name);
  const compare = {
    name: byName,
    paid: (a: T, b: T) => (paid[b.id] ?? 0) - (paid[a.id] ?? 0) || byName(a, b),
    newest: (a: T, b: T) => Date.parse(b.created_at) - Date.parse(a.created_at) || byName(a, b),
  }[sort];
  return [...payees].sort(compare);
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Largest value the Postgres `integer` column `amount_cents` can hold. */
export const MAX_CENTS = 2_147_483_647;

/** Formats integer cents as USD, e.g. 123456 -> "$1,234.56". */
export function formatCents(cents: number): string {
  return usd.format(cents / 100);
}

/**
 * Parses "12.5", "$1,234.56", ".99", etc. into cents.
 * Returns null if the input is invalid, not positive, has more than two
 * decimals, or is too large for the database.
 */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  const match = /^(\d*)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match) return null;

  const [, dollars, fraction = ""] = match;
  if (dollars === "" && fraction === "") return null;

  const cents = Number(dollars || "0") * 100 + Number(fraction.padEnd(2, "0"));
  if (cents <= 0 || cents > MAX_CENTS) return null;
  return cents;
}

/** Formats cents as a plain decimal for inputs and CSVs, e.g. 123456 -> "1234.56". */
export function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

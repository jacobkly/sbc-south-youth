const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Formats integer cents as USD, e.g. 123456 -> "$1,234.56". */
export function formatCents(cents: number): string {
  return usd.format(cents / 100);
}

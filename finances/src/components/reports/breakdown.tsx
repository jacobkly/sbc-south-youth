import { sharePercent } from "@/lib/dashboard/summary";
import { formatCents } from "@/lib/money";
import type { Slice } from "@/lib/reports/breakdowns";

export function requestCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "request" : "requests"}`;
}

/** Gives each slice its label. */
export function labeled<Key extends string, Item extends Slice<Key>>(items: Item[], labels: Record<Key, string>) {
  return items.map((item) => ({ ...item, label: labels[item.key] }));
}

type BreakdownItem = Slice<string> & { label: string };

/**
 * One group per row, with a bar for its share like the dashboard's top
 * payees. The numbers are always showing, so there's no chart to tap. Most
 * go by amount; `by="count"` goes by how many requests. `detail` says what
 * else each row has, before its share.
 */
export function Breakdown<Item extends BreakdownItem>({
  id,
  title,
  description,
  items,
  by = "amount",
  detail,
  empty,
}: {
  id: string;
  title: string;
  description: string;
  items: Item[];
  by?: "amount" | "count";
  detail?: (item: Item) => string;
  empty?: string;
}) {
  const measure = (item: Item) => (by === "count" ? item.count : item.cents);
  const total = items.reduce((sum, item) => sum + measure(item), 0);
  const describe = detail ?? ((item: Item) => (by === "count" ? formatCents(item.cents) : requestCount(item.count)));

  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-3">
      <div>
        <h2 id={`${id}-heading`} className="text-lg font-semibold">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {items.length > 0 ? (
        <dl className="divide-y rounded-lg border">
          {items.map((item) => {
            const value = measure(item);
            return (
              <div key={item.key} className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-2 px-4 py-3">
                <dt className="min-w-0 truncate text-sm font-medium">{item.label}</dt>
                <dd className="font-semibold tabular-nums">
                  {by === "count" ? requestCount(item.count) : formatCents(item.cents)}
                </dd>
                <dd className="col-span-2 space-y-2">
                  <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${value > 0 ? Math.max(2, (value / total) * 100) : 0}%` }}
                    />
                  </span>
                  <span className="block text-sm text-muted-foreground tabular-nums">
                    {describe(item)} · {sharePercent(value, total)}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

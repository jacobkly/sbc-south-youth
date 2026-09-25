import { cn } from "cn";
import {
  formatStorage,
  STORAGE_CRITICAL_PERCENT,
  STORAGE_LIMIT_BYTES,
  STORAGE_WARNING_PERCENT,
  storageUsage,
  type StorageLevel,
} from "@/lib/receipts/storage";

const BAR_STYLES: Record<StorageLevel, string> = {
  ok: "bg-primary",
  warning: "bg-amber-500",
  critical: "bg-red-600 dark:bg-red-500",
};

const MESSAGES: Record<Exclude<StorageLevel, "ok">, { text: string; className: string }> = {
  warning: {
    text: `Over ${STORAGE_WARNING_PERCENT}% full. The free plan includes 1 GB of receipt storage.`,
    className: "text-amber-900 dark:text-amber-200",
  },
  critical: {
    text: `Over ${STORAGE_CRITICAL_PERCENT}% full. Past 1 GB, Supabase can limit the project until older receipts are moved or the plan is upgraded.`,
    className: "text-red-700 dark:text-red-300",
  },
};

/** Receipt storage used against the 1 GB free plan, with warnings at 70% and 90%. */
export function StorageBar({ bytes }: { bytes: number }) {
  const { percent, level } = storageUsage(bytes);
  const used = `${formatStorage(bytes)} of 1 GB used`;
  // Keep a sliver visible once anything is stored.
  const width = bytes > 0 ? Math.min(100, Math.max(1, (bytes / STORAGE_LIMIT_BYTES) * 100)) : 0;
  const message = level === "ok" ? null : MESSAGES[level];

  return (
    <section aria-labelledby="storage-heading" className="space-y-3">
      <h2 id="storage-heading" className="text-lg font-semibold">
        Receipt storage
      </h2>
      <div className="space-y-2 rounded-lg border px-4 py-3">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-muted-foreground">{used}</span>
          <span className="font-medium tabular-nums">{percent}%</span>
        </div>
        <div
          role="meter"
          aria-labelledby="storage-heading"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(percent, 100)}
          aria-valuetext={`${percent}%, ${used}`}
          className="h-2.5 overflow-hidden rounded-full bg-muted"
        >
          <div className={cn("h-full rounded-full", BAR_STYLES[level])} style={{ width: `${width}%` }} />
        </div>
        {message && <p className={cn("text-sm", message.className)}>{message.text}</p>}
      </div>
    </section>
  );
}

/**
 * Receipt storage against the Supabase free plan's 1 GB. Counted in
 * decimal units (1 GB = 1,000,000,000 bytes), which is the smaller reading
 * of "1 GB", so the warnings never come late.
 */
export const STORAGE_LIMIT_BYTES = 1_000_000_000;

export const STORAGE_WARNING_PERCENT = 70;
export const STORAGE_CRITICAL_PERCENT = 90;

export type StorageLevel = "ok" | "warning" | "critical";

export type StorageUsage = {
  /** Whole percent used, rounded down so a warning never shows early. Can pass 100. */
  percent: number;
  level: StorageLevel;
};

export function storageUsage(bytes: number, limit = STORAGE_LIMIT_BYTES): StorageUsage {
  const percent = Math.floor((bytes / limit) * 100);
  const level =
    percent >= STORAGE_CRITICAL_PERCENT ? "critical" : percent >= STORAGE_WARNING_PERCENT ? "warning" : "ok";
  return { percent, level };
}

/** Bytes in decimal units, e.g. 123456789 -> "123.5 MB". */
export function formatStorage(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
}

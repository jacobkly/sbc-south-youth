import { z } from "zod";

/**
 * The storage bar on portal Home: files against the free plan's 1 GB,
 * shared by receipts, profile pictures and site photos, and the database
 * against its 500 MB. Counted in decimal units (1 GB = 1,000,000,000 bytes),
 * the smaller reading of "1 GB", so warnings never come late.
 */

export const STORAGE_LIMIT_BYTES = 1_000_000_000;
export const DATABASE_LIMIT_BYTES = 500_000_000;

/** Amber from here. */
export const WARNING_PERCENT = 80;
/** Red from here, where new site photos will stop so receipts keep room. */
export const CRITICAL_PERCENT = 95;

export type UsageLevel = "ok" | "warning" | "critical";

const summarySchema = z.object({
  buckets: z.array(
    z.object({
      bucket: z.string(),
      objects: z.number().int().nonnegative(),
      bytes: z.number().int().nonnegative(),
    }),
  ),
  database_bytes: z.number().int().nonnegative(),
});

/** What storage_summary() returns: sizes per bucket and the database's size, never file names. */
export type StorageSummary = z.infer<typeof summarySchema>;

/** Checks what storage_summary() returned. Throws rather than show wrong numbers. */
export function parseStorageSummary(data: unknown): StorageSummary {
  return summarySchema.parse(data);
}

export type StorageKind = "receipts" | "site-photos" | "avatars" | "other";

/** The buckets the bar names, in the order it shows them. Any other bucket counts as Other. */
const KINDS: { kind: Exclude<StorageKind, "other">; label: string }[] = [
  { kind: "receipts", label: "Receipts" },
  { kind: "site-photos", label: "Site photos" },
  { kind: "avatars", label: "Profile pictures" },
];

export type StorageSegment = {
  kind: StorageKind;
  label: string;
  bytes: number;
  objects: number;
  /** Percent of the bar's width. */
  width: number;
};

export type Usage = {
  bytes: number;
  limit: number;
  /** Whole percent used, rounded down. Can pass 100. */
  percent: number;
  level: UsageLevel;
  /** At or past the limit. */
  full: boolean;
};

export type StorageOverview = Usage & {
  used: number;
  free: number;
  segments: StorageSegment[];
  database: Usage;
};

export function usageLevel(percent: number): UsageLevel {
  if (percent >= CRITICAL_PERCENT) return "critical";
  if (percent >= WARNING_PERCENT) return "warning";
  return "ok";
}

function usage(bytes: number, limit: number): Usage {
  const percent = Math.floor((bytes * 100) / limit);
  return { bytes, limit, percent, level: usageLevel(percent), full: bytes >= limit };
}

/** Splits the summary into the bar's parts and works out how full both limits are. */
export function storageOverview(summary: StorageSummary): StorageOverview {
  const named = new Set<string>(KINDS.map(({ kind }) => kind));
  const total = (buckets: StorageSummary["buckets"]) => ({
    bytes: buckets.reduce((sum, bucket) => sum + bucket.bytes, 0),
    objects: buckets.reduce((sum, bucket) => sum + bucket.objects, 0),
  });

  const parts: Omit<StorageSegment, "width">[] = KINDS.map(({ kind, label }) => ({
    kind,
    label,
    ...total(summary.buckets.filter((bucket) => bucket.bucket === kind)),
  }));
  const other = total(summary.buckets.filter((bucket) => !named.has(bucket.bucket)));
  if (other.bytes > 0) parts.push({ kind: "other", label: "Other", ...other });

  const used = parts.reduce((sum, part) => sum + part.bytes, 0);
  // Past the limit, the parts share the whole bar instead of overflowing it.
  const scale = Math.max(STORAGE_LIMIT_BYTES, used);
  const segments = parts.map((part) => ({
    ...part,
    // Keep a sliver visible once anything is stored.
    width: part.bytes > 0 ? Math.max(1, (part.bytes / scale) * 100) : 0,
  }));

  return {
    ...usage(used, STORAGE_LIMIT_BYTES),
    used,
    free: Math.max(0, STORAGE_LIMIT_BYTES - used),
    segments,
    database: usage(summary.database_bytes, DATABASE_LIMIT_BYTES),
  };
}

/** Bytes in decimal units, e.g. 123456789 -> "123.5 MB". Rounds first, so it never shows "1000 KB". */
export function formatBytes(bytes: number): string {
  const kb = Math.round(bytes / 1000);
  if (kb < 1000) return `${kb} KB`;
  const mb = Math.round(bytes / 100_000) / 10;
  if (mb < 1000) return `${mb.toFixed(1)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
}

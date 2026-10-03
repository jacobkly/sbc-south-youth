import { CircleAlertIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "cn";
import { Skeleton } from "@/components/portal/ui/skeleton";
import { loadStorage } from "@/lib/portal/home/queries";
import {
  formatBytes,
  type StorageKind,
  type StorageOverview,
  type Usage,
  type UsageLevel,
} from "@/lib/portal/home/storage";

const SEGMENT_COLORS: Record<StorageKind, string> = {
  receipts: "bg-primary",
  "site-photos": "bg-sky-500 dark:bg-sky-400",
  avatars: "bg-violet-500 dark:bg-violet-400",
  other: "bg-muted-foreground/60",
};

const METER_COLORS: Record<UsageLevel, string> = {
  ok: "bg-primary",
  warning: "bg-amber-500",
  critical: "bg-red-600 dark:bg-red-500",
};

const LEVEL_TEXT: Record<UsageLevel, string> = {
  ok: "text-muted-foreground",
  warning: "text-amber-800 dark:text-amber-200",
  critical: "text-red-700 dark:text-red-300",
};

type Notes = { warning: string; critical: string; full: string };

const FILE_NOTES: Notes = {
  warning: "Files are over 80% of the free plan. Receipts and site photos share this space.",
  critical: "Files are nearly full. Past 1 GB, the free plan may limit uploads in both apps.",
  full: "Files are past the free plan's 1 GB, which may limit uploads in both apps.",
};

const DATABASE_NOTES: Notes = {
  warning: "The database is over 80% of the free plan's 500 MB.",
  critical: "The database is nearly full. Past 500 MB, it may stop taking changes.",
  full: "The database is past the free plan's 500 MB, so it may stop taking changes.",
};

/** A warning under a limit from 80%, or nothing below it. */
function Note({ usage, notes }: { usage: Usage; notes: Notes }) {
  if (usage.level === "ok") return null;
  return (
    <p className={cn("flex items-start gap-2 text-sm", LEVEL_TEXT[usage.level])}>
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      {usage.full ? notes.full : notes[usage.level]}
    </p>
  );
}

/** One limit's numbers: what's used, what it's out of, and the percent, colored past 80%. */
function UsageLine({
  label,
  usage,
  limitLabel,
  large,
}: {
  label: string;
  usage: Usage;
  limitLabel: string;
  large?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="min-w-0">
        <span className={cn("tabular-nums", large ? "text-xl font-semibold" : "font-medium")}>
          {formatBytes(usage.bytes)}
        </span>{" "}
        <span className="text-sm text-muted-foreground">
          of {limitLabel} {label}
        </span>
      </p>
      <p className={cn("shrink-0 text-sm tabular-nums", LEVEL_TEXT[usage.level])}>{usage.percent}%</p>
    </div>
  );
}

function meterProps(label: string, usage: Usage, limitLabel: string) {
  return {
    role: "meter",
    "aria-label": label,
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    "aria-valuenow": Math.min(usage.percent, 100),
    "aria-valuetext": `${usage.percent}%, ${formatBytes(usage.bytes)} of ${limitLabel}`,
  } as const;
}

/**
 * Files out of the free plan's 1 GB, split into receipts, site photos,
 * profile pictures, anything else, and what's free, then the database out of
 * its 500 MB. Each turns amber at 80% and red at 95%.
 */
export function StorageBar({ overview }: { overview: StorageOverview }) {
  const { segments, free, database } = overview;

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="space-y-2.5">
        <UsageLine label="for files" usage={overview} limitLabel="1 GB" large />
        <div
          {...meterProps("Files", overview, "1 GB")}
          className="flex h-2.5 gap-px overflow-hidden rounded-full bg-muted"
        >
          {segments
            .filter((segment) => segment.width > 0)
            .map((segment) => (
              <div
                key={segment.kind}
                className={cn("h-full", SEGMENT_COLORS[segment.kind])}
                style={{ width: `${segment.width}%` }}
              />
            ))}
        </div>
      </div>

      <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {segments.map((segment) => (
          <div key={segment.kind} className="flex items-center gap-2">
            <span className={cn("size-2.5 shrink-0 rounded-full", SEGMENT_COLORS[segment.kind])} aria-hidden />
            <dt className="min-w-0 flex-1 truncate text-muted-foreground">{segment.label}</dt>
            <dd className="tabular-nums">{formatBytes(segment.bytes)}</dd>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-full bg-muted ring-1 ring-foreground/20 ring-inset" aria-hidden />
          <dt className="min-w-0 flex-1 truncate text-muted-foreground">Free</dt>
          <dd className="tabular-nums">{formatBytes(free)}</dd>
        </div>
      </dl>

      <Note usage={overview} notes={FILE_NOTES} />

      <div className="space-y-2.5 border-t pt-4">
        <UsageLine label="for the database" usage={database} limitLabel="500 MB" />
        <div {...meterProps("Database", database, "500 MB")} className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", METER_COLORS[database.level])}
            // Keep a sliver visible, since the database is never empty.
            style={{ width: `${Math.min(100, Math.max(1, (database.bytes / database.limit) * 100))}%` }}
          />
        </div>
        <Note usage={database} notes={DATABASE_NOTES} />
      </div>
    </div>
  );
}

export function StorageBarSkeleton() {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4" aria-busy="true" aria-label="Loading storage">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-2.5 w-full rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

function StorageBarError() {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm">
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      <p className="text-muted-foreground">Storage couldn&apos;t load. Refresh the page to try again.</p>
    </div>
  );
}

/** Loads the numbers as the signed-in person. A failure only hides the bar, not the rest of Home. */
export async function HomeStorage() {
  let overview: StorageOverview;
  try {
    overview = await loadStorage();
  } catch (error) {
    console.error("[portal] Couldn't load storage", error);
    return <StorageBarError />;
  }
  return <StorageBar overview={overview} />;
}

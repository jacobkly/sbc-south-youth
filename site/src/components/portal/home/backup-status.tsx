import Link from "next/link";
import { ArrowRightIcon, CircleCheckIcon, DatabaseBackupIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "cn";
import { LoadError } from "@/components/portal/load-error";
import { Button } from "@/components/portal/ui/button";
import { Skeleton } from "@/components/portal/ui/skeleton";
import { activityHref, DEFAULT_ACTIVITY_FILTERS } from "@/lib/portal/activity/filters";
import { reportPortalError } from "@/lib/portal/errors";
import { backupStatus, type BackupReport, type BackupStatus as Status } from "@/lib/portal/home/backup";
import { loadLastBackup } from "@/lib/portal/home/queries";

const PAST_BACKUPS_HREF = activityHref({ ...DEFAULT_ACTIVITY_FILTERS, scope: "platform", kind: "backups" });

const CARD = "flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center";
const ICON_BOX = "flex size-10 shrink-0 items-center justify-center rounded-lg";

/**
 * The newest backup on an owner's Home: none yet, last night's with its
 * sizes, or amber once it's more than 48 hours old.
 */
export function BackupStatus({ status }: { status: Status }) {
  if (status.state === "none") {
    return (
      <div className={CARD}>
        <span className={cn(ICON_BOX, "bg-muted")} aria-hidden>
          <DatabaseBackupIcon className="size-5 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="font-medium">No backup yet</p>
          <p className="text-sm text-muted-foreground">Once the nightly backup runs, its time and size show here.</p>
        </div>
      </div>
    );
  }

  const stale = status.state === "stale";
  const Icon = stale ? TriangleAlertIcon : CircleCheckIcon;

  return (
    <div className={cn(CARD, stale && "border-amber-500/60")}>
      <span className={cn(ICON_BOX, stale ? "bg-amber-500/15" : "bg-primary/10")} aria-hidden>
        <Icon className={cn("size-5", stale ? "text-amber-700 dark:text-amber-300" : "text-primary")} />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm text-muted-foreground">Last backup</p>
        <p className="font-medium">
          <time dateTime={status.at}>{status.when}</time>
        </p>
        <p className="text-sm text-muted-foreground">{status.sizes}</p>
        {stale && (
          <p className="pt-1 text-sm text-amber-800 dark:text-amber-200">
            That was {status.age}. Backups run each night, so check that the backup job is still running.
          </p>
        )}
      </div>
      <Button asChild variant="outline" className="h-11 px-5">
        <Link href={PAST_BACKUPS_HREF}>
          Past backups
          <ArrowRightIcon aria-hidden />
        </Link>
      </Button>
    </div>
  );
}

export function BackupStatusSkeleton() {
  return (
    <div className={CARD} aria-busy="true" aria-label="Loading backups">
      <Skeleton className="size-10 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
    </div>
  );
}

/** Loads the newest backup as the signed-in owner. A failure only hides this card, not the rest of Home. */
export async function HomeBackup() {
  let report: BackupReport | null;
  try {
    report = await loadLastBackup();
  } catch (error) {
    await reportPortalError("Home backups", error);
    return <LoadError text="Backups couldn't load." />;
  }
  return <BackupStatus status={backupStatus(report, new Date())} />;
}

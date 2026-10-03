import { z } from "zod";
import { formatDayLabel, formatTime, laDateOf, todayInLA } from "@/lib/dates";
import { formatBytes } from "./storage";

/**
 * The backup line on an owner's Home. The nightly backup reports each finished
 * run through record_backup(), which logs backup.completed with its sizes.
 * Home shows the newest, and turns amber once it's more than 48 hours old,
 * since that means at least one night was missed.
 */

export const STALE_AFTER_HOURS = 48;

const HOUR_MS = 60 * 60 * 1000;

/** What record_backup() puts in the row's changes. */
const sizesSchema = z
  .object({
    database_bytes: z.number().int().positive(),
    file_bytes: z.number().int().nonnegative().nullish(),
    files: z.number().int().nonnegative().nullish(),
  })
  .transform(({ database_bytes, file_bytes, files }) => ({
    databaseBytes: database_bytes,
    fileBytes: file_bytes ?? null,
    files: files ?? null,
  }));

const reportSchema = z.object({
  created_at: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Not a time"),
  changes: sizesSchema,
});

export type BackupSizes = { databaseBytes: number; fileBytes: number | null; files: number | null };

export type BackupReport = BackupSizes & { at: string };

/** Reads a backup.completed row. Throws rather than show a wrong time. */
export function parseBackupReport(row: unknown): BackupReport {
  const { created_at, changes } = reportSchema.parse(row);
  return { at: created_at, ...changes };
}

/** A backup row's sizes, or null when they can't be read. */
export function readBackupSizes(changes: unknown): BackupSizes | null {
  const parsed = sizesSchema.safeParse(changes);
  return parsed.success ? parsed.data : null;
}

/** "Database 12.3 MB · Files 234.6 MB in 1,234 files", leaving out what the job didn't report. */
export function backupSizes({ databaseBytes, fileBytes, files }: BackupSizes): string {
  const parts = [`Database ${formatBytes(databaseBytes)}`];
  if (fileBytes !== null) {
    const count = files === null ? "" : ` in ${files.toLocaleString("en-US")} ${files === 1 ? "file" : "files"}`;
    parts.push(`Files ${formatBytes(fileBytes)}${count}`);
  }
  return parts.join(" · ");
}

export type BackupStatus =
  | { state: "none" }
  | {
      state: "fresh" | "stale";
      at: string;
      /** "Today at 2:14 AM", in LA. */
      when: string;
      /** "3 days ago", only once it's stale. */
      age: string | null;
      sizes: string;
    };

/** Where the newest backup stands at `now`: none yet, fresh, or stale after 48 hours. */
export function backupStatus(report: BackupReport | null, now: Date = new Date()): BackupStatus {
  if (!report) return { state: "none" };

  const hours = (now.getTime() - Date.parse(report.at)) / HOUR_MS;
  const stale = hours > STALE_AFTER_HOURS;
  const days = Math.floor(hours / 24);

  return {
    state: stale ? "stale" : "fresh",
    at: report.at,
    when: `${formatDayLabel(laDateOf(report.at), todayInLA(now))} at ${formatTime(report.at)}`,
    age: stale ? `${days} days ago` : null,
    sizes: backupSizes(report),
  };
}

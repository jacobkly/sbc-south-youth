import { describe, expect, it } from "vitest";
import { backupSizes, backupStatus, parseBackupReport, STALE_AFTER_HOURS } from "./backup";

const HOUR = 60 * 60 * 1000;
// Friday, Oct 2, 2026, 9:00 AM in Los Angeles.
const NOW = new Date("2026-10-02T16:00:00Z");

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * HOUR).toISOString();
}

function report(at: string, changes: Record<string, number | null> = { database_bytes: 12_345_678 }) {
  return parseBackupReport({ created_at: at, changes });
}

describe("parseBackupReport", () => {
  it("reads the time and sizes record_backup() logged", () => {
    expect(
      parseBackupReport({
        created_at: "2026-10-02T09:14:00+00:00",
        changes: { database_bytes: 12_345_678, file_bytes: 234_567_890, files: 1234 },
      }),
    ).toEqual({ at: "2026-10-02T09:14:00+00:00", databaseBytes: 12_345_678, fileBytes: 234_567_890, files: 1234 });
  });

  it("reads a backup of the database alone", () => {
    expect(
      parseBackupReport({
        created_at: "2026-10-02T09:14:00+00:00",
        changes: { database_bytes: 2_345_678, file_bytes: null, files: null },
      }),
    ).toEqual({ at: "2026-10-02T09:14:00+00:00", databaseBytes: 2_345_678, fileBytes: null, files: null });
  });

  it("throws on anything else, so Home shows its error instead of a wrong time", () => {
    expect(() => parseBackupReport({ created_at: "2026-10-02T09:14:00Z", changes: null })).toThrow();
    expect(() => parseBackupReport({ created_at: "soon", changes: { database_bytes: 1 } })).toThrow();
    expect(() => parseBackupReport({ created_at: "2026-10-02T09:14:00Z", changes: { database_bytes: -5 } })).toThrow();
  });
});

describe("backupSizes", () => {
  it("names the database and the files with how many there are", () => {
    expect(backupSizes({ databaseBytes: 12_345_678, fileBytes: 234_567_890, files: 1234 })).toBe(
      "Database 12.3 MB · Files 234.6 MB in 1,234 files",
    );
  });

  it("says one file, not one files", () => {
    expect(backupSizes({ databaseBytes: 12_345_678, fileBytes: 80_000, files: 1 })).toBe(
      "Database 12.3 MB · Files 80 KB in 1 file",
    );
  });

  it("leaves out files the job didn't report", () => {
    expect(backupSizes({ databaseBytes: 2_345_678, fileBytes: null, files: null })).toBe("Database 2.3 MB");
    expect(backupSizes({ databaseBytes: 2_345_678, fileBytes: 5_000_000, files: null })).toBe(
      "Database 2.3 MB · Files 5.0 MB",
    );
  });
});

describe("backupStatus", () => {
  it("says there's no backup yet when none has reported", () => {
    expect(backupStatus(null, NOW)).toEqual({ state: "none" });
  });

  it("is fresh for last night's backup, with the day and time in LA", () => {
    // 2:14 AM in Los Angeles today.
    expect(backupStatus(report("2026-10-02T09:14:00Z"), NOW)).toEqual({
      state: "fresh",
      at: "2026-10-02T09:14:00Z",
      when: "Today at 2:14 AM",
      age: null,
      sizes: "Database 12.3 MB",
    });
  });

  it("names yesterday by its name", () => {
    expect(backupStatus(report("2026-10-01T09:14:00Z"), NOW)).toMatchObject({
      state: "fresh",
      when: "Yesterday at 2:14 AM",
    });
  });

  it("stays fresh up to 48 hours", () => {
    expect(backupStatus(report(hoursAgo(STALE_AFTER_HOURS)), NOW).state).toBe("fresh");
  });

  it("goes stale after 48 hours and says how long it's been", () => {
    expect(backupStatus(report(hoursAgo(STALE_AFTER_HOURS + 0.5)), NOW)).toMatchObject({
      state: "stale",
      when: "Wed, Sep 30 at 8:30 AM",
      age: "2 days ago",
    });
    expect(backupStatus(report("2026-09-26T09:14:00Z"), NOW)).toMatchObject({
      state: "stale",
      when: "Sat, Sep 26 at 2:14 AM",
      age: "6 days ago",
    });
  });

  it("treats a time a little ahead of the server's clock as fresh", () => {
    expect(backupStatus(report(hoursAgo(-0.1)), NOW).state).toBe("fresh");
  });
});

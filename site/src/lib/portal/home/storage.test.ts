import { describe, expect, it } from "vitest";
import { formatBytes, parseStorageSummary, storageOverview, usageLevel } from "./storage";

const MB = 1_000_000;

function summary(buckets: { bucket: string; bytes: number; objects?: number }[], databaseBytes = 40 * MB) {
  return {
    buckets: buckets.map(({ bucket, bytes, objects = 1 }) => ({ bucket, objects, bytes })),
    database_bytes: databaseBytes,
  };
}

describe("parseStorageSummary", () => {
  it("reads what storage_summary() returns", () => {
    const parsed = parseStorageSummary({
      buckets: [{ bucket: "receipts", objects: 3, bytes: 200500 }],
      database_bytes: 44_000_000,
    });
    expect(parsed).toEqual({ buckets: [{ bucket: "receipts", objects: 3, bytes: 200500 }], database_bytes: 44_000_000 });
  });

  it("throws on anything else, so the bar shows its error instead of wrong numbers", () => {
    expect(() => parseStorageSummary(null)).toThrow();
    expect(() => parseStorageSummary({ buckets: [{ bucket: "receipts", bytes: -1, objects: 0 }] })).toThrow();
  });
});

describe("usageLevel", () => {
  it("turns amber at 80% and red at 95%", () => {
    expect(usageLevel(79)).toBe("ok");
    expect(usageLevel(80)).toBe("warning");
    expect(usageLevel(94)).toBe("warning");
    expect(usageLevel(95)).toBe("critical");
    expect(usageLevel(130)).toBe("critical");
  });
});

describe("storageOverview", () => {
  it("splits the 1 GB into receipts, profile pictures, site photos, and free space", () => {
    const overview = storageOverview(
      summary([
        { bucket: "avatars", bytes: 2 * MB },
        { bucket: "receipts", bytes: 300 * MB },
        { bucket: "site-photos", bytes: 100 * MB },
      ]),
    );

    expect(overview.segments.map(({ kind, label, bytes }) => ({ kind, label, bytes }))).toEqual([
      { kind: "receipts", label: "Receipts", bytes: 300 * MB },
      { kind: "site-photos", label: "Site photos", bytes: 100 * MB },
      { kind: "avatars", label: "Profile pictures", bytes: 2 * MB },
    ]);
    expect(overview.used).toBe(402 * MB);
    expect(overview.free).toBe(598 * MB);
    expect(overview.percent).toBe(40);
    expect(overview.level).toBe("ok");
  });

  it("always lists the three kinds, even before their bucket exists", () => {
    const overview = storageOverview(summary([{ bucket: "receipts", bytes: 5 * MB }]));
    expect(overview.segments.map((segment) => [segment.label, segment.bytes])).toEqual([
      ["Receipts", 5 * MB],
      ["Site photos", 0],
      ["Profile pictures", 0],
    ]);
  });

  it("adds up any other bucket as Other, and lists it only when it holds something", () => {
    const empty = storageOverview(summary([{ bucket: "exports", bytes: 0, objects: 0 }]));
    expect(empty.segments.map((segment) => segment.kind)).not.toContain("other");

    const overview = storageOverview(
      summary([
        { bucket: "exports", bytes: 3 * MB },
        { bucket: "scratch", bytes: 1 * MB },
      ]),
    );
    expect(overview.segments.at(-1)).toMatchObject({ kind: "other", label: "Other", bytes: 4 * MB, objects: 2 });
    expect(overview.used).toBe(4 * MB);
  });

  it("sizes each part of the bar by its share of 1 GB, with a sliver for anything stored", () => {
    const overview = storageOverview(
      summary([
        { bucket: "receipts", bytes: 250 * MB },
        { bucket: "avatars", bytes: 40_000 },
      ]),
    );
    const width = Object.fromEntries(overview.segments.map((segment) => [segment.kind, segment.width]));
    expect(width).toEqual({ receipts: 25, "site-photos": 0, avatars: 1 });
  });

  it("warns at 80% and turns red at 95%, rounding down so neither comes early", () => {
    expect(storageOverview(summary([{ bucket: "receipts", bytes: 799_999_999 }]))).toMatchObject({
      percent: 79,
      level: "ok",
    });
    expect(storageOverview(summary([{ bucket: "receipts", bytes: 800 * MB }]))).toMatchObject({
      percent: 80,
      level: "warning",
    });
    expect(storageOverview(summary([{ bucket: "receipts", bytes: 950 * MB }]))).toMatchObject({
      percent: 95,
      level: "critical",
      full: false,
    });
  });

  it("past 1 GB, shows no free space and keeps the bar's parts inside it", () => {
    const overview = storageOverview(
      summary([
        { bucket: "receipts", bytes: 900 * MB },
        { bucket: "site-photos", bytes: 300 * MB },
      ]),
    );
    expect(overview.free).toBe(0);
    expect(overview.percent).toBe(120);
    expect(overview.full).toBe(true);
    expect(overview.segments.reduce((total, segment) => total + segment.width, 0)).toBeCloseTo(100);
  });

  it("measures the database against its 500 MB", () => {
    expect(storageOverview(summary([], 44 * MB)).database).toEqual({
      bytes: 44 * MB,
      limit: 500 * MB,
      percent: 8,
      level: "ok",
      full: false,
    });
    expect(storageOverview(summary([], 400 * MB)).database).toMatchObject({ percent: 80, level: "warning" });
    expect(storageOverview(summary([], 500 * MB)).database).toMatchObject({ percent: 100, full: true });
  });

  it("handles nothing stored at all", () => {
    const overview = storageOverview(summary([]));
    expect(overview).toMatchObject({ used: 0, free: 1000 * MB, percent: 0, level: "ok" });
    expect(overview.segments.every((segment) => segment.width === 0)).toBe(true);
  });
});

describe("formatBytes", () => {
  it("uses decimal units, like the free plan's limits", () => {
    expect(formatBytes(0)).toBe("0 KB");
    expect(formatBytes(4200)).toBe("4 KB");
    expect(formatBytes(123_456_789)).toBe("123.5 MB");
    expect(formatBytes(1_000_000_000)).toBe("1.00 GB");
  });

  it("moves up a unit when rounding reaches the next one", () => {
    expect(formatBytes(999_600)).toBe("1.0 MB");
    expect(formatBytes(999_963_094)).toBe("1.00 GB");
  });
});

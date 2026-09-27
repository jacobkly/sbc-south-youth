import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { reportTotals } from "./filters";
import {
  bucketLabel,
  bucketTick,
  reportTimeline,
  timelineBefore,
  timelineUnit,
  type TimelineBucket,
  type TimelineRow,
} from "./timeline";

function bought(date: string, type: TimelineRow["type"], cents: number): TimelineRow {
  return { purchase_date: date, paid_at: null, type, amount_cents: cents };
}

function paid(instant: string, type: TimelineRow["type"], cents: number): TimelineRow {
  // A purchase date far outside the range, so only the paid date can place it.
  return { purchase_date: "2020-01-01", paid_at: instant, type, amount_cents: cents };
}

function spans(buckets: TimelineBucket[]): string[] {
  return buckets.map((bucket) => `${bucket.start}..${bucket.end}`);
}

/** Each bucket starts the day after the one before it ends. */
function isContiguous(buckets: TimelineBucket[]): boolean {
  return buckets.every((bucket, index) => index === 0 || bucket.start === addDays(buckets[index - 1].end, 1));
}

describe("timelineUnit", () => {
  it("uses days for a month or shorter", () => {
    expect(timelineUnit({ start: "2026-09-26", end: "2026-09-26" })).toBe("day");
    expect(timelineUnit({ start: "2026-01-01", end: "2026-01-31" })).toBe("day");
  });

  it("uses weeks for up to a quarter", () => {
    expect(timelineUnit({ start: "2026-01-01", end: "2026-02-01" })).toBe("week");
    expect(timelineUnit({ start: "2026-07-01", end: "2026-09-30" })).toBe("week");
  });

  it("uses months for up to two years", () => {
    expect(timelineUnit({ start: "2026-07-01", end: "2026-10-01" })).toBe("month");
    expect(timelineUnit({ start: "2026-01-01", end: "2026-12-31" })).toBe("month");
    // 731 days, with a leap year.
    expect(timelineUnit({ start: "2023-01-01", end: "2024-12-31" })).toBe("month");
  });

  it("uses years beyond two years", () => {
    expect(timelineUnit({ start: "2023-01-01", end: "2025-01-01" })).toBe("year");
  });
});

describe("reportTimeline", () => {
  it("has a bucket for every day of a month, empty ones included", () => {
    const { unit, buckets } = reportTimeline([bought("2026-09-05", "cafe", 1200)], {
      start: "2026-09-01",
      end: "2026-09-30",
    }, "purchase");

    expect(unit).toBe("day");
    expect(buckets).toHaveLength(30);
    expect(buckets[0]).toEqual({ start: "2026-09-01", end: "2026-09-01", cents: 0, count: 0, byType: { cafe: 0, youth: 0 } });
    expect(buckets[4]).toEqual({ start: "2026-09-05", end: "2026-09-05", cents: 1200, count: 1, byType: { cafe: 1200, youth: 0 } });
    expect(buckets[29].end).toBe("2026-09-30");
    expect(isContiguous(buckets)).toBe(true);
  });

  it("counts weeks from the first day and folds a short last week into the one before", () => {
    // Q3 is 13 weeks and a day, so the last week runs 8 days.
    const { unit, buckets } = reportTimeline([], { start: "2026-07-01", end: "2026-09-30" }, "purchase");

    expect(unit).toBe("week");
    expect(buckets).toHaveLength(13);
    expect(buckets[0]).toMatchObject({ start: "2026-07-01", end: "2026-07-07" });
    expect(buckets[12]).toMatchObject({ start: "2026-09-23", end: "2026-09-30" });
    expect(isContiguous(buckets)).toBe(true);
  });

  it("keeps a last week of four days or more on its own", () => {
    // Q1 2026 is 12 weeks and 6 days.
    const { buckets } = reportTimeline([], { start: "2026-01-01", end: "2026-03-31" }, "purchase");

    expect(buckets).toHaveLength(13);
    expect(buckets[12]).toMatchObject({ start: "2026-03-26", end: "2026-03-31" });
  });

  it("uses calendar months, cut to the range at the ends", () => {
    const { unit, buckets } = reportTimeline([], { start: "2025-09-15", end: "2026-06-10" }, "purchase");

    expect(unit).toBe("month");
    expect(spans(buckets)).toEqual([
      "2025-09-15..2025-09-30",
      "2025-10-01..2025-10-31",
      "2025-11-01..2025-11-30",
      "2025-12-01..2025-12-31",
      "2026-01-01..2026-01-31",
      "2026-02-01..2026-02-28",
      "2026-03-01..2026-03-31",
      "2026-04-01..2026-04-30",
      "2026-05-01..2026-05-31",
      "2026-06-01..2026-06-10",
    ]);
  });

  it("starts years at the first one with a request, keeping empty years after it", () => {
    const rows = [bought("2024-05-01", "youth", 500), bought("2026-02-01", "cafe", 700)];
    const { unit, buckets } = reportTimeline(rows, { start: "2021-03-01", end: "2026-09-26" }, "purchase");

    expect(unit).toBe("year");
    expect(spans(buckets)).toEqual(["2024-01-01..2024-12-31", "2025-01-01..2025-12-31", "2026-01-01..2026-09-26"]);
    expect(buckets.map((bucket) => bucket.cents)).toEqual([500, 0, 700]);
  });

  it("keeps every year when there are no requests", () => {
    const { buckets } = reportTimeline([], { start: "2023-06-01", end: "2026-09-26" }, "purchase");

    expect(buckets.map((bucket) => bucket.start)).toEqual(["2023-06-01", "2024-01-01", "2025-01-01", "2026-01-01"]);
  });

  it("places requests by the Los Angeles date they were paid", () => {
    // 11:30 PM on July 7 in Los Angeles, already July 8 in UTC.
    const rows = [paid("2026-07-08T06:30:00Z", "youth", 2500), paid("2026-07-08T07:30:00Z", "cafe", 1000)];
    const { buckets } = reportTimeline(rows, { start: "2026-07-01", end: "2026-09-30" }, "paid");

    expect(buckets[0]).toMatchObject({ start: "2026-07-01", cents: 2500, count: 1, byType: { cafe: 0, youth: 2500 } });
    expect(buckets[1]).toMatchObject({ start: "2026-07-08", cents: 1000, count: 1, byType: { cafe: 1000, youth: 0 } });
  });

  it("splits each bucket by type and matches the report totals", () => {
    const rows = [
      bought("2026-01-03", "cafe", 1234),
      bought("2026-01-03", "youth", 4321),
      bought("2026-06-30", "youth", 999),
      bought("2026-12-31", "cafe", 1),
    ];
    const { buckets } = reportTimeline(rows, { start: "2026-01-01", end: "2026-12-31" }, "purchase");
    const totals = reportTotals(rows);

    expect(buckets[0]).toMatchObject({ cents: 5555, count: 2, byType: { cafe: 1234, youth: 4321 } });
    expect(buckets.reduce((sum, bucket) => sum + bucket.cents, 0)).toBe(totals.cents);
    expect(buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(totals.count);
    expect(buckets.reduce((sum, bucket) => sum + bucket.byType.cafe, 0)).toBe(totals.byType.cafe.cents);
  });

  it("skips requests outside the range or without a paid date", () => {
    const rows = [bought("2026-08-31", "cafe", 100), paid("2026-09-10T19:00:00Z", "cafe", 200), bought("2026-09-10", "cafe", 300)];
    const purchase = reportTimeline(rows, { start: "2026-09-01", end: "2026-09-30" }, "purchase");
    const paidBasis = reportTimeline([bought("2026-09-10", "cafe", 300)], { start: "2026-09-01", end: "2026-09-30" }, "paid");

    expect(purchase.buckets.reduce((sum, bucket) => sum + bucket.cents, 0)).toBe(300);
    expect(paidBasis.buckets.every((bucket) => bucket.count === 0)).toBe(true);
  });
});

describe("bucket labels", () => {
  it("gives each unit a short axis label", () => {
    expect(bucketTick({ start: "2026-09-05", end: "2026-09-05" }, "day")).toBe("5");
    expect(bucketTick({ start: "2026-07-29", end: "2026-08-04" }, "week")).toBe("Jul 29");
    expect(bucketTick({ start: "2025-09-15", end: "2025-09-30" }, "month")).toBe("Sep");
    expect(bucketTick({ start: "2026-01-01", end: "2026-09-26" }, "year")).toBe("2026");
  });

  it("gives each unit a full label for the tooltip and table", () => {
    expect(bucketLabel({ start: "2026-09-05", end: "2026-09-05" }, "day")).toBe("Sep 5");
    expect(bucketLabel({ start: "2026-07-01", end: "2026-07-07" }, "week")).toBe("Jul 1 – 7");
    expect(bucketLabel({ start: "2026-07-29", end: "2026-08-04" }, "week")).toBe("Jul 29 – Aug 4");
    expect(bucketLabel({ start: "2025-12-29", end: "2026-01-04" }, "week")).toBe("Dec 29, 2025 – Jan 4, 2026");
    expect(bucketLabel({ start: "2025-09-15", end: "2025-09-30" }, "month")).toBe("September 2025");
    expect(bucketLabel({ start: "2026-01-01", end: "2026-09-26" }, "year")).toBe("2026");
  });
});

describe("timelineBefore", () => {
  it("lines up days, and stops where a running month's comparison ends", () => {
    const range = { start: "2026-09-01", end: "2026-09-30" };
    const before = { start: "2026-08-01", end: "2026-08-27" };
    const timeline = reportTimeline([], range, "purchase");
    const lined = timelineBefore(
      timeline,
      range,
      { range: before, rows: [bought("2026-08-01", "cafe", 500), bought("2026-08-01", "cafe", 250), bought("2026-08-27", "cafe", 900)] },
      "purchase",
    );

    expect(lined).toHaveLength(30);
    expect(lined[0]).toEqual({ start: "2026-08-01", end: "2026-08-01", cents: 750 });
    expect(lined[1]).toEqual({ start: "2026-08-02", end: "2026-08-02", cents: 0 });
    expect(lined[26]).toEqual({ start: "2026-08-27", end: "2026-08-27", cents: 900 });
    expect(lined.slice(27)).toEqual([null, null, null]);
  });

  it("leaves out rows outside the period before, and days past the end of the report", () => {
    const range = { start: "2026-09-01", end: "2026-09-30" };
    const before = { start: "2026-08-01", end: "2026-08-31" };
    const timeline = reportTimeline([], range, "purchase");
    const lined = timelineBefore(
      timeline,
      range,
      // August 31 has no September 31 to line up with.
      { range: before, rows: [bought("2026-07-31", "cafe", 100), bought("2026-08-30", "cafe", 200), bought("2026-08-31", "cafe", 400)] },
      "purchase",
    );

    expect(lined[29]).toEqual({ start: "2026-08-30", end: "2026-08-30", cents: 200 });
    expect(lined.reduce((sum, bucket) => sum + (bucket?.cents ?? 0), 0)).toBe(200);
  });

  it("lines up weeks by the day, and cuts the last one where the comparison ends", () => {
    const range = { start: "2026-07-01", end: "2026-09-30" };
    const before = { start: "2026-04-01", end: "2026-06-28" };
    const timeline = reportTimeline([], range, "purchase");
    const lined = timelineBefore(
      timeline,
      range,
      { range: before, rows: [bought("2026-04-07", "cafe", 300), bought("2026-04-08", "cafe", 50), bought("2026-06-24", "cafe", 700)] },
      "purchase",
    );

    expect(lined).toHaveLength(13);
    expect(lined[0]).toEqual({ start: "2026-04-01", end: "2026-04-07", cents: 300 });
    expect(lined[1]).toEqual({ start: "2026-04-08", end: "2026-04-14", cents: 50 });
    // The report's last week runs 8 days, September 23 to 30.
    expect(lined[12]).toEqual({ start: "2026-06-24", end: "2026-06-28", cents: 700 });
  });

  it("lines up months by the calendar", () => {
    const range = { start: "2026-01-01", end: "2026-12-31" };
    const before = { start: "2025-01-01", end: "2025-09-27" };
    const timeline = reportTimeline([], range, "purchase");
    const lined = timelineBefore(
      timeline,
      range,
      { range: before, rows: [bought("2025-02-28", "cafe", 1000), bought("2025-09-27", "cafe", 600)] },
      "purchase",
    );

    expect(lined).toHaveLength(12);
    expect(lined[1]).toEqual({ start: "2025-02-01", end: "2025-02-28", cents: 1000 });
    expect(lined[8]).toEqual({ start: "2025-09-01", end: "2025-09-27", cents: 600 });
    expect(lined.slice(9)).toEqual([null, null, null]);
  });

  it("places paid requests by the day they were paid in LA", () => {
    const range = { start: "2026-09-01", end: "2026-09-30" };
    const before = { start: "2026-08-01", end: "2026-08-31" };
    const timeline = reportTimeline([], range, "paid");
    const lined = timelineBefore(
      timeline,
      range,
      {
        range: before,
        // 9:30 PM PDT on August 4 is August 5 in UTC.
        rows: [{ purchase_date: "2020-01-01", paid_at: "2026-08-05T04:30:00Z", type: "youth", amount_cents: 800 }],
      },
      "paid",
    );

    expect(lined[3]).toEqual({ start: "2026-08-04", end: "2026-08-04", cents: 800 });
  });

  it("follows the report's years, which start at its first year with a request", () => {
    // 1,096 days each: 2023 to 2025, and 2020 to 2022.
    const range = { start: "2023-01-01", end: "2025-12-31" };
    const before = { start: "2020-01-01", end: "2022-12-31" };
    const timeline = reportTimeline([bought("2024-05-01", "cafe", 100)], range, "purchase");
    const lined = timelineBefore(
      timeline,
      range,
      { range: before, rows: [bought("2020-06-01", "cafe", 50), bought("2021-06-01", "cafe", 70)] },
      "purchase",
    );

    expect(timeline.buckets.map((bucket) => bucket.start)).toEqual(["2024-01-01", "2025-01-01"]);
    expect(lined).toEqual([
      { start: "2021-01-01", end: "2021-12-31", cents: 70 },
      { start: "2022-01-01", end: "2022-12-31", cents: 0 },
    ]);
  });
});

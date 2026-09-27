import { describe, expect, it } from "vitest";
import { reportTimeline, type BeforeBucket } from "./timeline";
import {
  DAY_BANDS,
  formatDays,
  IMPORTED_REASON,
  median,
  paidDays,
  paidDaysBreakdown,
  paidDaysTimeline,
  runningTotals,
  waits,
  type TimingRow,
} from "./timing";

function request(overrides: Partial<TimingRow> = {}): TimingRow {
  return {
    type: "cafe",
    amount_cents: 1000,
    purchase_date: "2026-09-01",
    submitted_at: null,
    approved_at: null,
    paid_at: null,
    no_receipt_reason: null,
    ...overrides,
  };
}

/** Noon in Los Angeles on a September date, while daylight saving is on. */
function noon(date: string): string {
  return `${date}T19:00:00.000Z`;
}

describe("paidDays", () => {
  it("counts calendar days in Los Angeles from purchase to paid", () => {
    // 11:30 PM on Sep 10 in LA is already Sep 11 in UTC.
    expect(paidDays(request({ purchase_date: "2026-09-01", paid_at: "2026-09-11T06:30:00Z" }))).toBe(9);
  });

  it("is 0 when paid the day it was bought", () => {
    expect(paidDays(request({ purchase_date: "2026-09-10", paid_at: noon("2026-09-10") }))).toBe(0);
  });

  it("is null until paid", () => {
    expect(paidDays(request({ approved_at: noon("2026-09-02") }))).toBeNull();
  });

  it("is null for imported requests, which had one date for both", () => {
    expect(
      paidDays(request({ purchase_date: "2026-09-10", paid_at: noon("2026-09-10"), no_receipt_reason: IMPORTED_REASON })),
    ).toBeNull();
  });

  it("never goes below 0 when the paid date is before the purchase date", () => {
    expect(paidDays(request({ purchase_date: "2026-09-12", paid_at: noon("2026-09-10") }))).toBe(0);
  });
});

describe("median", () => {
  it("takes the middle value, in any order", () => {
    expect(median([9, 1, 4])).toBe(4);
  });

  it("averages the two middle values of an even count", () => {
    expect(median([1, 2, 3, 10])).toBe(2.5);
  });

  it("is null for nothing", () => {
    expect(median([])).toBeNull();
  });
});

describe("formatDays", () => {
  it("says same day, one day, or how many", () => {
    expect(formatDays(0)).toBe("Same day");
    expect(formatDays(1)).toBe("1 day");
    expect(formatDays(2.5)).toBe("2.5 days");
    expect(formatDays(12)).toBe("12 days");
  });
});

describe("waits", () => {
  it("gives the median and longest wait from purchase to paid, leaving out imported requests", () => {
    const rows = [
      request({ purchase_date: "2026-09-01", paid_at: noon("2026-09-03") }),
      request({ purchase_date: "2026-09-01", paid_at: noon("2026-09-06") }),
      request({ purchase_date: "2026-09-01", paid_at: noon("2026-09-22") }),
      request({ purchase_date: "2026-09-04", paid_at: noon("2026-09-04"), no_receipt_reason: IMPORTED_REASON }),
      request({ purchase_date: "2026-09-05", approved_at: noon("2026-09-06") }),
    ];
    const result = waits(rows);
    expect(result.boughtToPaid).toEqual({ count: 3, median: 5, longest: 21 });
    expect(result.imported).toBe(1);
  });

  it("measures submitted to approved only for requests that were submitted and approved", () => {
    const rows = [
      request({ submitted_at: noon("2026-09-02"), approved_at: noon("2026-09-03") }),
      request({ submitted_at: noon("2026-09-02"), approved_at: noon("2026-09-05") }),
      // Submitted and still waiting.
      request({ submitted_at: noon("2026-09-02") }),
      // Approved straight from a draft.
      request({ approved_at: noon("2026-09-04") }),
    ];
    expect(waits(rows).submittedToApproved).toEqual({ count: 2, median: 2, longest: 3 });
  });

  it("measures approved to paid, leaving out requests recorded as paid in one step", () => {
    const rows = [
      request({ approved_at: noon("2026-09-02"), paid_at: noon("2026-09-09") }),
      request({ approved_at: "2026-09-02T19:00:00+00:00", paid_at: noon("2026-09-02") }),
      // Paid on a date picked before the day it was approved.
      request({ approved_at: noon("2026-09-05"), paid_at: noon("2026-09-03") }),
    ];
    expect(waits(rows).approvedToPaid).toEqual({ count: 2, median: 3.5, longest: 7 });
  });

  it("has no median or longest when nothing was measured", () => {
    const result = waits([request()]);
    expect(result.boughtToPaid).toEqual({ count: 0, median: null, longest: null });
    expect(result.submittedToApproved).toEqual({ count: 0, median: null, longest: null });
    expect(result.approvedToPaid).toEqual({ count: 0, median: null, longest: null });
    expect(result.imported).toBe(0);
  });
});

describe("paidDaysBreakdown", () => {
  it("puts each paid request in a band by days to paid, keeping every band", () => {
    const paidAfter = (days: number, cents: number) =>
      request({ purchase_date: "2026-01-01", paid_at: `${addDaysUtc("2026-01-01", days)}T20:00:00.000Z`, amount_cents: cents });
    const rows = [
      paidAfter(0, 100),
      paidAfter(1, 200),
      paidAfter(7, 300),
      paidAfter(8, 400),
      paidAfter(14, 500),
      paidAfter(30, 600),
      paidAfter(61, 700),
      request({ amount_cents: 9999 }),
      request({ purchase_date: "2026-01-01", paid_at: "2026-01-01T20:00:00.000Z", no_receipt_reason: IMPORTED_REASON }),
    ];
    const bands = paidDaysBreakdown(rows);
    expect(bands.map((band) => band.key)).toEqual([...DAY_BANDS]);
    expect(bands.map((band) => [band.key, band.count, band.cents])).toEqual([
      ["same_day", 1, 100],
      ["1_to_7", 2, 500],
      ["8_to_14", 2, 900],
      ["15_to_30", 1, 600],
      ["31_to_60", 0, 0],
      ["over_60", 1, 700],
    ]);
  });
});

describe("paidDaysTimeline", () => {
  const range = { start: "2026-09-01", end: "2026-09-30" };

  it("gives the median days to paid in each bucket, by purchase date", () => {
    const rows = [
      request({ purchase_date: "2026-09-02", paid_at: noon("2026-09-05") }),
      request({ purchase_date: "2026-09-02", paid_at: noon("2026-09-07") }),
      request({ purchase_date: "2026-09-10", paid_at: noon("2026-09-10") }),
      request({ purchase_date: "2026-09-12" }),
    ];
    const buckets = paidDaysTimeline(rows, reportTimeline(rows, range, "purchase"), "purchase");
    expect(buckets).toHaveLength(30);
    expect(buckets[1]).toEqual({ count: 2, median: 4 });
    expect(buckets[9]).toEqual({ count: 1, median: 0 });
    expect(buckets[11]).toEqual({ count: 0, median: null });
  });

  it("places requests by the Los Angeles date they were paid", () => {
    const rows = [request({ purchase_date: "2026-08-20", paid_at: "2026-09-04T06:30:00Z" })];
    const buckets = paidDaysTimeline(rows, reportTimeline(rows, range, "paid"), "paid");
    expect(buckets[2]).toEqual({ count: 1, median: 14 });
    expect(buckets.filter((bucket) => bucket.count > 0)).toHaveLength(1);
  });

  it("leaves out imported requests and requests outside the range", () => {
    const rows = [
      request({ purchase_date: "2026-09-03", paid_at: noon("2026-09-03"), no_receipt_reason: IMPORTED_REASON }),
      request({ purchase_date: "2026-08-31", paid_at: noon("2026-09-02") }),
    ];
    const buckets = paidDaysTimeline(rows, reportTimeline(rows, range, "purchase"), "purchase");
    expect(buckets.every((bucket) => bucket.count === 0)).toBe(true);
  });
});

describe("runningTotals", () => {
  const range = { start: "2026-09-01", end: "2026-09-05" };
  const rows = [
    request({ purchase_date: "2026-09-01", amount_cents: 1000 }),
    request({ purchase_date: "2026-09-03", amount_cents: 500 }),
  ];
  const timeline = reportTimeline(rows, range, "purchase");

  it("adds up each bucket, stopping after today, alongside the period before's running total", () => {
    const before: BeforeBucket[] = [
      { start: "2026-08-01", end: "2026-08-01", cents: 300 },
      { start: "2026-08-02", end: "2026-08-02", cents: 0 },
      { start: "2026-08-03", end: "2026-08-03", cents: 700 },
      null,
      null,
    ];
    expect(runningTotals(timeline, before, "2026-09-04")).toEqual([
      { cents: 1000, before: 300 },
      { cents: 1000, before: 300 },
      { cents: 1500, before: 1000 },
      { cents: 1500, before: null },
      { cents: null, before: null },
    ]);
  });

  it("has no period before line without a period before", () => {
    expect(runningTotals(timeline, null, "2026-09-30").map((point) => point.before)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});

/** The ISO date `days` after a date, worked out in UTC so the test doesn't lean on the code under test. */
function addDaysUtc(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

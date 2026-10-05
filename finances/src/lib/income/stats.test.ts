import { describe, expect, it } from "vitest";
import { groupByMonth, titheStats, youthSummary, type YouthEntry } from "./stats";

let next = 0;

function entry(values: Partial<YouthEntry> = {}): YouthEntry {
  next += 1;
  return {
    id: `e${next}`,
    kind: "tithe",
    received_on: "2026-10-04",
    amount_cents: 2500,
    method: "cash_app",
    event_name: null,
    ...values,
  };
}

describe("titheStats", () => {
  it("has no average or middle with no tithes", () => {
    expect(titheStats([])).toEqual({
      count: 0,
      total: 0,
      average: null,
      median: null,
      byMethod: [
        { method: "cash_app", count: 0, total: 0 },
        { method: "zelle", count: 0, total: 0 },
        { method: "cash", count: 0, total: 0 },
      ],
    });
  });

  it("uses a single tithe as its own average and middle", () => {
    const stats = titheStats([entry({ amount_cents: 4000 })]);
    expect(stats).toMatchObject({ count: 1, total: 4000, average: 4000, median: 4000 });
  });

  it("takes the middle of an odd count", () => {
    const stats = titheStats([entry({ amount_cents: 10000 }), entry({ amount_cents: 1000 }), entry({ amount_cents: 2000 })]);
    expect(stats.median).toBe(2000);
    expect(stats.average).toBe(4333);
  });

  it("averages the two middle tithes of an even count, to the cent", () => {
    const stats = titheStats([
      entry({ amount_cents: 1000 }),
      entry({ amount_cents: 5001 }),
      entry({ amount_cents: 2000 }),
      entry({ amount_cents: 9000 }),
    ]);
    expect(stats.median).toBe(3501);
  });

  it("leaves events out, so one bake sale doesn't skew the average", () => {
    const stats = titheStats([
      entry({ amount_cents: 2000 }),
      entry({ kind: "event", amount_cents: 38000, event_name: "Bake sale", method: null }),
    ]);
    expect(stats).toMatchObject({ count: 1, total: 2000, average: 2000, median: 2000 });
  });

  it("splits tithes by how they came in", () => {
    const stats = titheStats([
      entry({ amount_cents: 2000, method: "cash_app" }),
      entry({ amount_cents: 3000, method: "cash_app" }),
      entry({ amount_cents: 500, method: "cash" }),
    ]);
    expect(stats.byMethod).toEqual([
      { method: "cash_app", count: 2, total: 5000 },
      { method: "zelle", count: 0, total: 0 },
      { method: "cash", count: 1, total: 500 },
    ]);
  });
});

describe("youthSummary", () => {
  it("adds tithes and events into the youth total", () => {
    const summary = youthSummary([
      entry({ amount_cents: 2000 }),
      entry({ amount_cents: 3000 }),
      entry({ kind: "event", amount_cents: 38000, method: null }),
    ]);
    expect(summary.total).toBe(43000);
    expect(summary.tithes).toMatchObject({ count: 2, total: 5000 });
    expect(summary.events).toEqual({ count: 1, total: 38000 });
  });
});

describe("groupByMonth", () => {
  it("groups entries by the month they came in, keeping their order", () => {
    const a = entry({ received_on: "2026-10-04", amount_cents: 2000 });
    const b = entry({ received_on: "2026-10-01", kind: "event", amount_cents: 5000 });
    const c = entry({ received_on: "2026-09-27", amount_cents: 1500 });

    expect(groupByMonth([a, b, c])).toEqual([
      { period: { kind: "month", year: 2026, month: 10 }, total: 7000, entries: [a, b] },
      { period: { kind: "month", year: 2026, month: 9 }, total: 1500, entries: [c] },
    ]);
  });

  it("has no months with no entries", () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

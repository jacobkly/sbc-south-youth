import { describe, expect, it } from "vitest";
import { payeeTotals, sumByPayee } from "./totals";

describe("payeeTotals", () => {
  it("sums paid requests by year and all time, and approved ones as waiting", () => {
    const totals = payeeTotals(
      [
        { status: "paid", amount_cents: 1250, paid_at: "2026-03-10T18:00:00Z" },
        { status: "paid", amount_cents: 4000, paid_at: "2025-06-01T18:00:00Z" },
        { status: "approved", amount_cents: 700, paid_at: null },
        { status: "approved", amount_cents: 300, paid_at: null },
      ],
      2026,
    );
    expect(totals).toEqual({ paidInYear: 1250, paidAllTime: 5250, toPay: 1000, toPayCount: 2 });
  });

  it("puts a payment in the year of its LA date", () => {
    const rows = [
      // Dec 31, 2026 at 11 PM in LA, already 2027 in UTC.
      { status: "paid" as const, amount_cents: 500, paid_at: "2027-01-01T07:00:00Z" },
      // Jan 1, 2027 at midnight in LA.
      { status: "paid" as const, amount_cents: 900, paid_at: "2027-01-01T08:00:00Z" },
    ];
    expect(payeeTotals(rows, 2026).paidInYear).toBe(500);
    expect(payeeTotals(rows, 2027).paidInYear).toBe(900);
  });

  it("ignores drafts, open, rejected, and cancelled requests", () => {
    const totals = payeeTotals(
      [
        { status: "draft", amount_cents: 100, paid_at: null },
        { status: "submitted", amount_cents: 200, paid_at: null },
        { status: "needs_info", amount_cents: 300, paid_at: null },
        { status: "rejected", amount_cents: 400, paid_at: null },
        { status: "cancelled", amount_cents: 500, paid_at: null },
      ],
      2026,
    );
    expect(totals).toEqual({ paidInYear: 0, paidAllTime: 0, toPay: 0, toPayCount: 0 });
  });
});

describe("sumByPayee", () => {
  it("adds up cents for each payee", () => {
    expect(
      sumByPayee([
        { payee_id: "a", amount_cents: 1000 },
        { payee_id: "b", amount_cents: 250 },
        { payee_id: "a", amount_cents: 99 },
      ]),
    ).toEqual({ a: 1099, b: 250 });
  });

  it("returns an empty map for no rows", () => {
    expect(sumByPayee([])).toEqual({});
  });
});

import { describe, expect, it } from "vitest";
import type { PayeeTotals } from "./filters";
import { newPayeeBreakdown, payeeAverage, topPayees } from "./payees";

/** A payee with the given cafe and youth totals, one request per type they have. */
function payee(id: string, cafe: number, youth = 0): PayeeTotals {
  const cafeCount = cafe > 0 ? 1 : 0;
  const youthCount = youth > 0 ? 1 : 0;
  return {
    payeeId: id,
    name: `Payee ${id}`,
    cents: cafe + youth,
    count: cafeCount + youthCount,
    byType: { cafe: { cents: cafe, count: cafeCount }, youth: { cents: youth, count: youthCount } },
  };
}

/** Payees "1" to "n", biggest first like reportPayeeTotals. */
function payees(n: number): PayeeTotals[] {
  return Array.from({ length: n }, (_, index) => payee(String(index + 1), (n - index) * 1000));
}

describe("topPayees", () => {
  it("keeps the top payees and adds up everyone after them", () => {
    const list = [...payees(10), payee("11", 300, 200), payee("12", 0, 100)];
    const { top, rest } = topPayees(list);
    expect(top.map((p) => p.payeeId)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    expect(rest).toEqual({
      payees: 2,
      cents: 600,
      count: 3,
      byType: { cafe: { cents: 300, count: 1 }, youth: { cents: 300, count: 2 } },
    });
  });

  it("shows one extra payee on its own instead of as everyone else", () => {
    const { top, rest } = topPayees(payees(11));
    expect(top).toHaveLength(11);
    expect(rest).toBeNull();
  });

  it("shows everyone when there are only a few", () => {
    expect(topPayees(payees(3))).toEqual({ top: payees(3), rest: null });
    expect(topPayees([])).toEqual({ top: [], rest: null });
  });

  it("takes a smaller limit", () => {
    const { top, rest } = topPayees(payees(5), 2);
    expect(top.map((p) => p.payeeId)).toEqual(["1", "2"]);
    expect(rest?.payees).toBe(3);
    expect(rest?.cents).toBe(3000 + 2000 + 1000);
  });
});

describe("payeeAverage", () => {
  it("averages the amount and the requests per payee", () => {
    const list = [payee("a", 1000), payee("b", 1000, 1000), payee("c", 3001)];
    expect(payeeAverage(list)).toEqual({ cents: 2000, requests: 4 / 3 });
  });

  it("rounds the amount to the nearest cent", () => {
    expect(payeeAverage([payee("a", 1000), payee("b", 1001)]).cents).toBe(1001);
  });

  it("is zero with no payees", () => {
    expect(payeeAverage([])).toEqual({ cents: 0, requests: 0 });
  });
});

describe("newPayeeBreakdown", () => {
  it("splits payees seen before the period from new ones", () => {
    const list = [payee("a", 4000), payee("b", 1500, 500), payee("c", 700)];
    expect(newPayeeBreakdown(list, new Set(["a", "c"]))).toEqual([
      { key: "new", payees: 1, count: 2, cents: 2000 },
      { key: "returning", payees: 2, count: 2, cents: 4700 },
    ]);
  });

  it("keeps both groups, so nobody returning shows as zero", () => {
    expect(newPayeeBreakdown([payee("a", 900)], new Set())).toEqual([
      { key: "new", payees: 1, count: 1, cents: 900 },
      { key: "returning", payees: 0, count: 0, cents: 0 },
    ]);
  });

  it("ignores returning payees who aren't in the report", () => {
    expect(newPayeeBreakdown([payee("a", 900)], new Set(["z"]))[1]).toEqual({
      key: "returning",
      payees: 0,
      count: 0,
      cents: 0,
    });
  });
});

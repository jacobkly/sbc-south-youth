import { describe, expect, it } from "vitest";
import {
  paymentMethodBreakdown,
  receiptBreakdown,
  sizeBreakdown,
  statusBreakdown,
  type BreakdownRow,
} from "./breakdowns";

function row(changes: Partial<BreakdownRow> = {}): BreakdownRow {
  return { status: "approved", amount_cents: 1000, missing_receipt: false, payment_method: null, ...changes };
}

function paid(method: BreakdownRow["payment_method"], cents: number): BreakdownRow {
  return row({ status: "paid", payment_method: method, amount_cents: cents });
}

describe("statusBreakdown", () => {
  it("counts and adds up each status, in the order a request moves through them", () => {
    const rows = [
      row({ status: "paid", amount_cents: 2000 }),
      row({ status: "cancelled", amount_cents: 300 }),
      row({ status: "submitted", amount_cents: 500 }),
      row({ status: "paid", amount_cents: 4000 }),
      row({ status: "approved", amount_cents: 1500 }),
    ];
    expect(statusBreakdown(rows)).toEqual([
      { key: "submitted", count: 1, cents: 500 },
      { key: "approved", count: 1, cents: 1500 },
      { key: "paid", count: 2, cents: 6000 },
      { key: "cancelled", count: 1, cents: 300 },
    ]);
  });

  it("leaves out statuses the report has none of", () => {
    expect(statusBreakdown([row({ status: "paid" })]).map((slice) => slice.key)).toEqual(["paid"]);
    expect(statusBreakdown([])).toEqual([]);
  });
});

describe("sizeBreakdown", () => {
  it("puts each request in the band its amount falls in, counting each band's lower edge", () => {
    const amounts = [1, 2499, 2500, 4999, 5000, 9999, 10000, 250000];
    expect(sizeBreakdown(amounts.map((amount_cents) => row({ amount_cents })))).toEqual([
      { key: "under_25", count: 2, cents: 2500 },
      { key: "25_to_50", count: 2, cents: 7499 },
      { key: "50_to_100", count: 2, cents: 14999 },
      { key: "100_up", count: 2, cents: 260000 },
    ]);
  });

  it("keeps every band, even an empty one", () => {
    expect(sizeBreakdown([row({ amount_cents: 7500 })])).toEqual([
      { key: "under_25", count: 0, cents: 0 },
      { key: "25_to_50", count: 0, cents: 0 },
      { key: "50_to_100", count: 1, cents: 7500 },
      { key: "100_up", count: 0, cents: 0 },
    ]);
  });
});

describe("receiptBreakdown", () => {
  it("splits requests with every receipt from those missing one", () => {
    const rows = [
      row({ missing_receipt: false, amount_cents: 1200 }),
      row({ missing_receipt: true, amount_cents: 800 }),
      row({ missing_receipt: false, amount_cents: 300 }),
    ];
    expect(receiptBreakdown(rows)).toEqual([
      { key: "with", count: 2, cents: 1500 },
      { key: "missing", count: 1, cents: 800 },
    ]);
  });

  it("keeps both, so none missing shows as zero", () => {
    expect(receiptBreakdown([row({ missing_receipt: null, amount_cents: 500 })])).toEqual([
      { key: "with", count: 1, cents: 500 },
      { key: "missing", count: 0, cents: 0 },
    ]);
  });
});

describe("paymentMethodBreakdown", () => {
  it("adds up paid requests by how they were paid, most paid first", () => {
    const rows = [
      paid("check", 2000),
      paid("cash_app", 1500),
      paid("cash_app", 1000),
      paid("cash", 2000),
      paid("other", 100),
    ];
    expect(paymentMethodBreakdown(rows)).toEqual([
      { key: "cash_app", count: 2, cents: 2500 },
      { key: "check", count: 1, cents: 2000 },
      { key: "cash", count: 1, cents: 2000 },
      { key: "other", count: 1, cents: 100 },
    ]);
  });

  it("counts only paid requests", () => {
    const rows = [row({ status: "approved", amount_cents: 9000 }), paid("bank_transfer", 700)];
    expect(paymentMethodBreakdown(rows)).toEqual([{ key: "bank_transfer", count: 1, cents: 700 }]);
    expect(paymentMethodBreakdown([row()])).toEqual([]);
  });
});

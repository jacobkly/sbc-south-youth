import { describe, expect, it } from "vitest";
import {
  paymentMethodBreakdown,
  receiptBreakdown,
  sizeBreakdown,
  statusBreakdown,
  tagBreakdown,
  vendorBreakdown,
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

describe("vendorBreakdown", () => {
  function lines(...entries: [vendor: string | null, cents: number][]) {
    return { lines: entries.map(([vendor, amount_cents]) => ({ vendor, amount_cents })) };
  }

  it("adds up each receipt under its vendor, grouping spellings that differ only in case or spacing", () => {
    const rows = [
      lines(["Test  Market", 1200], ["Test Grocer", 300]),
      lines([" test market ", 800]),
      lines(["TEST GROCER", 2500]),
    ];
    expect(vendorBreakdown(rows)).toEqual([
      { key: "name:test grocer", label: "Test Grocer", count: 2, cents: 2800 },
      { key: "name:test market", label: "Test  Market", count: 2, cents: 2000 },
    ]);
  });

  it("puts receipts with no vendor last, whatever they add up to", () => {
    const rows = [lines([null, 9000], ["Test Market", 100]), lines(["  ", 50])];
    expect(vendorBreakdown(rows)).toEqual([
      { key: "name:test market", label: "Test Market", count: 1, cents: 100 },
      { key: "none", label: "No vendor", count: 2, cents: 9050 },
    ]);
  });

  it("adds up the vendors past the top ones in one row", () => {
    const rows = [lines(["Shop A", 500], ["Shop B", 400], ["Shop C", 300], ["Shop D", 200], ["Shop D", 50], [null, 10])];
    expect(vendorBreakdown(rows, 2)).toEqual([
      { key: "name:shop a", label: "Shop A", count: 1, cents: 500 },
      { key: "name:shop b", label: "Shop B", count: 1, cents: 400 },
      { key: "other", label: "2 other vendors", count: 3, cents: 550 },
      { key: "none", label: "No vendor", count: 1, cents: 10 },
    ]);
  });

  it("shows one vendor past the top on its own, since adding up one saves nothing", () => {
    const rows = [lines(["Shop A", 500], ["Shop B", 400], ["Shop C", 300])];
    expect(vendorBreakdown(rows, 2).map((slice) => slice.label)).toEqual(["Shop A", "Shop B", "Shop C"]);
  });

  it("breaks ties by count, then by name", () => {
    const rows = [lines(["Shop B", 500], ["Shop A", 500], ["Shop C", 250], ["Shop C", 250])];
    expect(vendorBreakdown(rows).map((slice) => slice.label)).toEqual(["Shop C", "Shop A", "Shop B"]);
  });

  it("is empty when no receipt has a vendor", () => {
    expect(vendorBreakdown([lines([null, 500])])).toEqual([]);
    expect(vendorBreakdown([])).toEqual([]);
  });
});

describe("tagBreakdown", () => {
  function request(amount_cents: number, ...names: string[]) {
    return { amount_cents, tags: names.map((name) => ({ tag: { id: `id-${name}`, name } })) };
  }

  it("adds up each tag's requests, with untagged ones last", () => {
    const rows = [request(4000, "Test Retreat"), request(9000), request(1000, "Test Retreat"), request(2500, "Test Kickoff")];
    expect(tagBreakdown(rows)).toEqual([
      { key: "name:test retreat", label: "Test Retreat", count: 2, cents: 5000 },
      { key: "name:test kickoff", label: "Test Kickoff", count: 1, cents: 2500 },
      { key: "none", label: "No tag", count: 1, cents: 9000 },
    ]);
  });

  it("counts a request with two tags under both", () => {
    expect(tagBreakdown([request(1200, "Snacks", "Test Retreat")])).toEqual([
      { key: "name:snacks", label: "Snacks", count: 1, cents: 1200 },
      { key: "name:test retreat", label: "Test Retreat", count: 1, cents: 1200 },
    ]);
  });

  it("skips a tag that couldn't be read", () => {
    expect(tagBreakdown([{ amount_cents: 500, tags: [{ tag: null }] }])).toEqual([]);
  });

  it("adds up the tags past the top ones in one row", () => {
    const rows = [request(300, "Tag A"), request(200, "Tag B"), request(100, "Tag C")];
    expect(tagBreakdown(rows, 1)).toEqual([
      { key: "name:tag a", label: "Tag A", count: 1, cents: 300 },
      { key: "other", label: "2 other tags", count: 2, cents: 300 },
    ]);
  });

  it("is empty when no request has a tag", () => {
    expect(tagBreakdown([request(500), { amount_cents: 500, tags: null }])).toEqual([]);
  });
});

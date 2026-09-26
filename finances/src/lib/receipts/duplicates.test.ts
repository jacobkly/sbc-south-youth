import { describe, expect, it } from "vitest";
import { receiptMatches, type ReceiptMatchRow } from "./duplicates";

function row(id: string, requestNumber: number, payee: string | null = "Alex Example"): ReceiptMatchRow {
  return {
    request: {
      id,
      request_number: requestNumber,
      status: "paid",
      amount_cents: 4599,
      payee: payee === null ? null : { full_name: payee },
    },
  };
}

describe("receiptMatches", () => {
  it("lists each request once, newest first", () => {
    expect(receiptMatches([row("a", 3), row("b", 12), row("a", 3)])).toEqual([
      { requestId: "b", requestNumber: 12, status: "paid", payeeName: "Alex Example", amountCents: 4599, current: false },
      { requestId: "a", requestNumber: 3, status: "paid", payeeName: "Alex Example", amountCents: 4599, current: false },
    ]);
  });

  it("puts the request being edited first", () => {
    const matches = receiptMatches([row("a", 3), row("b", 12)], "a");
    expect(matches.map((match) => [match.requestId, match.current])).toEqual([
      ["a", true],
      ["b", false],
    ]);
  });

  it("skips rows without a readable request and keeps a missing payee as null", () => {
    expect(receiptMatches([{ request: null }, row("a", 3, null)])).toEqual([
      { requestId: "a", requestNumber: 3, status: "paid", payeeName: null, amountCents: 4599, current: false },
    ]);
  });

  it("finds nothing in no rows", () => {
    expect(receiptMatches([])).toEqual([]);
  });
});

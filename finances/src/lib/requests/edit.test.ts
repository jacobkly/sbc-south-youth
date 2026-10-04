import { describe, expect, it } from "vitest";
import { toEditableRequest } from "./edit";

const row = {
  request_number: 7,
  status: "draft" as const,
  payee_id: "00000000-0000-4000-8000-00000000b001",
  type: "youth" as const,
  amount_cents: 1750,
  purchase_date: "2026-01-10",
  description: null,
  event_name: "Lock-in",
  no_receipt: false,
  no_receipt_reason: null,
  paid_at: null,
  payment_method: null,
  payment_reference: null,
  lines: [
    { id: "00000000-0000-4000-8000-00000000f001", amount_cents: 1250, vendor: "Fake Store" },
    { id: "00000000-0000-4000-8000-00000000f002", amount_cents: 500, vendor: null },
  ],
  receipts: [],
};

describe("toEditableRequest", () => {
  it("fills the form, with blanks for what's empty", () => {
    const request = toEditableRequest("00000000-0000-4000-8000-00000000c001", row, "Pat Example", null);
    expect(request.values).toEqual({
      payee_id: row.payee_id,
      type: "youth",
      purchase_date: "2026-01-10",
      lines: [
        { id: "00000000-0000-4000-8000-00000000f001", amount: "12.50", vendor: "Fake Store" },
        { id: "00000000-0000-4000-8000-00000000f002", amount: "5.00", vendor: "" },
      ],
      description: "",
      event_name: "Lock-in",
      no_receipt: false,
      no_receipt_reason: "",
    });
  });

  it("has nothing to correct while it's still open", () => {
    expect(toEditableRequest("00000000-0000-4000-8000-00000000c001", row, "Pat Example", null).correction).toBeNull();
  });

  it("keeps an approved request as saved, to compare a correction with", () => {
    const request = toEditableRequest(
      "00000000-0000-4000-8000-00000000c001",
      { ...row, status: "approved" },
      "Pat Example",
      null,
    );
    expect(request.correction).toEqual({
      type: "youth",
      purchase_date: "2026-01-10",
      description: null,
      event_name: "Lock-in",
      no_receipt: false,
      no_receipt_reason: null,
      lines: [
        { amount_cents: 1250, vendor: "Fake Store" },
        { amount_cents: 500, vendor: null },
      ],
      paid_at: null,
      payment_method: null,
      payment_reference: null,
    });
  });

  it("keeps a paid request's payment too", () => {
    const request = toEditableRequest(
      "00000000-0000-4000-8000-00000000c001",
      {
        ...row,
        status: "paid",
        paid_at: "2026-01-15T20:00:00+00:00",
        payment_method: "check",
        payment_reference: "Check 1042",
      },
      "Pat Example",
      null,
    );
    expect(request.correction).toMatchObject({
      paid_at: "2026-01-15T20:00:00+00:00",
      payment_method: "check",
      payment_reference: "Check 1042",
    });
  });
});

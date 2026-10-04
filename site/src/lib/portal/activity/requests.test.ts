import { describe, expect, it } from "vitest";
import {
  changedPayeeIds,
  describeRequestChanges,
  eventFilename,
  formatRequestNumber,
  requestEventTitle,
  requestTitle,
} from "./requests";

const PAYEE_A = "00000000-0000-4000-8000-00000000000a";
const PAYEE_B = "00000000-0000-4000-8000-00000000000b";

describe("requestEventTitle", () => {
  it("labels each action", () => {
    expect(requestEventTitle({ action: "recorded_paid", from_status: "draft" })).toBe("Recorded as paid");
    expect(requestEventTitle({ action: "unpaid", from_status: "paid" })).toBe("Payment undone");
    expect(requestEventTitle({ action: "info_requested", from_status: "submitted" })).toBe("Asked for more info");
  });

  it("calls uploads files, since a receipt is an amount that can have several", () => {
    expect(requestEventTitle({ action: "receipt_added", from_status: "draft" })).toBe("File added");
    expect(requestEventTitle({ action: "receipt_removed", from_status: "draft" })).toBe("File removed");
  });

  it("calls a submit after an info request a resubmit", () => {
    expect(requestEventTitle({ action: "submitted", from_status: "draft" })).toBe("Submitted");
    expect(requestEventTitle({ action: "submitted", from_status: "needs_info" })).toBe("Resubmitted");
  });

  it("calls a fix to an approved or paid request a correction", () => {
    expect(requestEventTitle({ action: "corrected", from_status: "paid" })).toBe("Corrected");
  });

  it("shows an unknown action as is", () => {
    expect(requestEventTitle({ action: "archived", from_status: null })).toBe("archived");
  });
});

describe("eventFilename", () => {
  it("names the file for receipt events only", () => {
    const changes = { receipt_id: "x", filename: "Test receipt.jpg" };
    expect(eventFilename({ action: "receipt_added", changes })).toBe("Test receipt.jpg");
    expect(eventFilename({ action: "receipt_removed", changes })).toBe("Test receipt.jpg");
    expect(eventFilename({ action: "updated", changes })).toBeNull();
    expect(eventFilename({ action: "receipt_added", changes: null })).toBeNull();
  });
});

describe("describeRequestChanges", () => {
  it("formats each changed field in form order", () => {
    const changes = {
      vendor: { from: "Test Market", to: "Test Grocer" },
      amount_cents: { from: 4000, to: 4210 },
      purchase_date: { from: "2026-09-20", to: "2026-09-21" },
      type: { from: "cafe", to: "youth" },
    };
    expect(describeRequestChanges({ action: "updated", changes })).toEqual([
      { field: "type", label: "Type", from: "Cafe", to: "Youth" },
      { field: "amount_cents", label: "Amount", from: "$40.00", to: "$42.10" },
      { field: "purchase_date", label: "Purchase date", from: "Sep 20, 2026", to: "Sep 21, 2026" },
      { field: "vendor", label: "Vendor", from: "Test Market", to: "Test Grocer" },
    ]);
  });

  it("shows a corrected payment by its date, method, and reference", () => {
    const changes = {
      payment_reference: { from: "Envelope 3", to: null },
      paid_at: { from: "2026-01-15T20:00:00+00:00", to: "2026-01-17T07:30:00.000Z" },
      payment_method: { from: "cash", to: "check" },
      amount_cents: { from: 1000, to: 1750 },
    };
    expect(describeRequestChanges({ action: "corrected", changes })).toEqual([
      { field: "amount_cents", label: "Amount", from: "$10.00", to: "$17.50" },
      { field: "payment_method", label: "Paid with", from: "Cash", to: "Check" },
      // 7:30 a.m. UTC is still the night before in Los Angeles.
      { field: "paid_at", label: "Date paid", from: "Jan 15, 2026", to: "Jan 16, 2026" },
      { field: "payment_reference", label: "Reference", from: "Envelope 3", to: "None" },
    ]);
  });

  it("shows blanks as none and the no-receipt toggle as on or off", () => {
    const changes = {
      event_name: { from: null, to: "Test Retreat" },
      no_receipt: { from: false, to: true },
      no_receipt_reason: { from: null, to: "Lost it" },
    };
    expect(describeRequestChanges({ action: "updated", changes })).toEqual([
      { field: "event_name", label: "Event", from: "None", to: "Test Retreat" },
      { field: "no_receipt", label: "No receipt on file", from: "Off", to: "On" },
      { field: "no_receipt_reason", label: "Why there's no receipt", from: "None", to: "Lost it" },
    ]);
  });

  it("lists each receipt's amount and vendor, after the total", () => {
    const changes = {
      lines: {
        from: [{ amount_cents: 1000, vendor: "Test Market" }],
        to: [
          { amount_cents: 1000, vendor: "Test Market" },
          { amount_cents: 1550, vendor: "Test Grocer" },
          { amount_cents: 500, vendor: null },
        ],
      },
      amount_cents: { from: 1000, to: 3050 },
    };
    expect(describeRequestChanges({ action: "updated", changes })).toEqual([
      { field: "amount_cents", label: "Amount", from: "$10.00", to: "$30.50" },
      {
        field: "lines",
        label: "Receipts",
        from: "$10.00 Test Market",
        to: "$10.00 Test Market, $15.50 Test Grocer, $5.00",
      },
    ]);
  });

  it("names payees, and says so when one can't be found", () => {
    const changes = { payee_id: { from: PAYEE_A, to: PAYEE_B } };
    const names = new Map([[PAYEE_A, "Test Payee"]]);
    expect(describeRequestChanges({ action: "submitted", changes }, names)).toEqual([
      { field: "payee_id", label: "Payee", from: "Test Payee", to: "Unknown payee" },
    ]);
  });

  it("has nothing to show for receipt events or missing changes", () => {
    const receipt = { action: "receipt_added", changes: { receipt_id: "x", filename: "a.jpg" } };
    expect(describeRequestChanges(receipt)).toEqual([]);
    expect(describeRequestChanges({ action: "updated", changes: null })).toEqual([]);
    expect(describeRequestChanges({ action: "updated", changes: { unknown: { from: 1, to: 2 } } })).toEqual([]);
  });
});

describe("changedPayeeIds", () => {
  it("collects payee ids from edits, once each", () => {
    expect(
      changedPayeeIds([
        { action: "updated", changes: { payee_id: { from: PAYEE_A, to: PAYEE_B } } },
        { action: "submitted", changes: { payee_id: { from: PAYEE_B, to: PAYEE_A } } },
        { action: "updated", changes: { vendor: { from: "a", to: "b" } } },
        { action: "created", changes: null },
      ]),
    ).toEqual([PAYEE_A, PAYEE_B]);
  });
});

describe("requestTitle and formatRequestNumber", () => {
  it("names a request by its vendor, else what was bought, else its type", () => {
    expect(requestTitle({ vendor: "Test Market", description: "Snacks", type: "youth" })).toBe("Test Market");
    expect(requestTitle({ vendor: null, description: "Snacks", type: "youth" })).toBe("Snacks");
    expect(requestTitle({ vendor: null, description: null, type: "cafe" })).toBe("Cafe purchase");
  });

  it("pads the number people see", () => {
    expect(formatRequestNumber(7)).toBe("R-0007");
    expect(formatRequestNumber(12345)).toBe("R-12345");
  });
});

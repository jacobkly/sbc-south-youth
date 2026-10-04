import { describe, expect, it } from "vitest";
import {
  changedPayeeIds,
  describeChanges,
  eventFilename,
  eventTitle,
  infoRequestNote,
  lateCheckDate,
  type RequestEvent,
} from "./status";

const PAYEE_A = "00000000-0000-4000-8000-00000000000a";
const PAYEE_B = "00000000-0000-4000-8000-00000000000b";

describe("eventTitle", () => {
  it("labels each action", () => {
    expect(eventTitle({ action: "recorded_paid", from_status: "draft" })).toBe("Recorded as paid");
    expect(eventTitle({ action: "unpaid", from_status: "paid" })).toBe("Payment undone");
  });

  it("calls uploads files, since a receipt is an amount that can have several", () => {
    expect(eventTitle({ action: "receipt_added", from_status: "draft" })).toBe("File added");
    expect(eventTitle({ action: "receipt_removed", from_status: "draft" })).toBe("File removed");
  });

  it("calls a submit after an info request a resubmit", () => {
    expect(eventTitle({ action: "submitted", from_status: "draft" })).toBe("Submitted");
    expect(eventTitle({ action: "submitted", from_status: "needs_info" })).toBe("Resubmitted");
  });

  it("calls a fix to an approved or paid request a correction", () => {
    expect(eventTitle({ action: "corrected", from_status: "paid" })).toBe("Corrected");
  });

  it("shows an unknown action as is", () => {
    expect(eventTitle({ action: "archived", from_status: null })).toBe("archived");
  });
});

describe("infoRequestNote", () => {
  const event = (action: string, note: string | null, created_at: string): RequestEvent => ({
    action,
    from_status: null,
    note,
    changes: null,
    created_at,
  });

  it("finds the newest question, in any order", () => {
    const events = [
      event("info_requested", "Which store?", "2026-09-01T10:00:00Z"),
      event("info_requested", "Which retreat?", "2026-09-03T10:00:00Z"),
      event("submitted", null, "2026-09-02T10:00:00Z"),
    ];
    expect(infoRequestNote(events)).toBe("Which retreat?");
  });

  it("has nothing to show without a question", () => {
    expect(infoRequestNote([])).toBeNull();
    expect(infoRequestNote([event("submitted", null, "2026-09-01T10:00:00Z")])).toBeNull();
    expect(infoRequestNote([event("info_requested", "  ", "2026-09-01T10:00:00Z")])).toBeNull();
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

describe("describeChanges", () => {
  it("formats each changed field in form order", () => {
    const changes = {
      vendor: { from: "Test Market", to: "Test Grocer" },
      amount_cents: { from: 4000, to: 4210 },
      purchase_date: { from: "2026-09-20", to: "2026-09-21" },
      type: { from: "cafe", to: "youth" },
    };
    expect(describeChanges({ action: "updated", changes })).toEqual([
      { field: "type", label: "Type", from: "Cafe", to: "Youth" },
      { field: "amount_cents", label: "Amount", from: "$40.00", to: "$42.10" },
      { field: "purchase_date", label: "Purchase date", from: "Sep 20, 2026", to: "Sep 21, 2026" },
      { field: "vendor", label: "Vendor", from: "Test Market", to: "Test Grocer" },
    ]);
  });

  it("shows blanks as none and the no-receipt toggle as on or off", () => {
    const changes = {
      event_name: { from: null, to: "Test Retreat" },
      no_receipt: { from: false, to: true },
      no_receipt_reason: { from: null, to: "Lost it" },
    };
    expect(describeChanges({ action: "updated", changes })).toEqual([
      { field: "event_name", label: "Event", from: "None", to: "Test Retreat" },
      { field: "no_receipt", label: "No receipt on file", from: "Off", to: "On" },
      { field: "no_receipt_reason", label: "Why there's no receipt", from: "None", to: "Lost it" },
    ]);
  });

  it("lists each receipt's amount and vendor, after the total", () => {
    const changes = {
      vendor: { from: "Test Market", to: "Test Market, Test Grocer" },
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
    expect(describeChanges({ action: "updated", changes })).toEqual([
      { field: "amount_cents", label: "Amount", from: "$10.00", to: "$30.50" },
      {
        field: "lines",
        label: "Receipts",
        from: "$10.00 Test Market",
        to: "$10.00 Test Market, $15.50 Test Grocer, $5.00",
      },
      { field: "vendor", label: "Vendor", from: "Test Market", to: "Test Market, Test Grocer" },
    ]);
  });

  it("shows a corrected payment by its date, method, and reference", () => {
    const changes = {
      payment_reference: { from: "Envelope 3", to: null },
      paid_at: { from: "2026-01-15T20:00:00+00:00", to: "2026-01-17T07:30:00.000Z" },
      payment_method: { from: "cash", to: "check" },
      amount_cents: { from: 1000, to: 1750 },
    };
    expect(describeChanges({ action: "corrected", changes })).toEqual([
      { field: "amount_cents", label: "Amount", from: "$10.00", to: "$17.50" },
      { field: "payment_method", label: "Paid with", from: "Cash", to: "Check" },
      // 7:30 a.m. UTC is still the night before in Los Angeles.
      { field: "paid_at", label: "Date paid", from: "Jan 15, 2026", to: "Jan 16, 2026" },
      { field: "payment_reference", label: "Reference", from: "Envelope 3", to: "None" },
    ]);
  });

  it("names payees, and says so when one can't be found", () => {
    const changes = { payee_id: { from: PAYEE_A, to: PAYEE_B } };
    const names = new Map([[PAYEE_A, "Test Payee"]]);
    expect(describeChanges({ action: "submitted", changes }, names)).toEqual([
      { field: "payee_id", label: "Payee", from: "Test Payee", to: "Unknown payee" },
    ]);
  });

  it("has nothing to show for receipt events or missing changes", () => {
    expect(describeChanges({ action: "receipt_added", changes: { receipt_id: "x", filename: "a.jpg" } })).toEqual([]);
    expect(describeChanges({ action: "updated", changes: null })).toEqual([]);
    expect(describeChanges({ action: "updated", changes: { unknown: { from: 1, to: 2 } } })).toEqual([]);
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

describe("lateCheckDate", () => {
  const today = "2026-09-25";

  it("measures to the first time it was sent for review, in LA", () => {
    const events = [
      { action: "created", created_at: "2026-09-01T17:00:00Z" },
      // 9:30 PM PDT on Sep 2 is Sep 3 in UTC.
      { action: "submitted", created_at: "2026-09-03T04:30:00Z" },
      { action: "info_requested", created_at: "2026-09-04T17:00:00Z" },
      { action: "submitted", created_at: "2026-09-20T17:00:00Z" },
    ];
    expect(lateCheckDate("submitted", events, today)).toEqual({ date: "2026-09-02", sent: true });
  });

  it("counts approving a draft as sending it", () => {
    const events = [
      { action: "created", created_at: "2026-09-01T17:00:00Z" },
      { action: "approved", created_at: "2026-09-02T17:00:00Z" },
    ];
    expect(lateCheckDate("approved", events, today)).toEqual({ date: "2026-09-02", sent: true });
  });

  it("measures a draft to today", () => {
    expect(lateCheckDate("draft", [{ action: "created", created_at: "2026-09-01T17:00:00Z" }], today)).toEqual({
      date: today,
      sent: false,
    });
  });

  it("skips requests recorded as paid, even after the payment is undone", () => {
    const events = [
      { action: "created", created_at: "2026-09-01T17:00:00Z" },
      { action: "recorded_paid", created_at: "2026-09-01T17:01:00Z" },
      { action: "unpaid", created_at: "2026-09-02T17:00:00Z" },
    ];
    expect(lateCheckDate("approved", events, today)).toBeNull();
  });

  it("skips a draft that was cancelled without being sent", () => {
    const events = [
      { action: "created", created_at: "2026-09-01T17:00:00Z" },
      { action: "cancelled", created_at: "2026-09-02T17:00:00Z" },
    ];
    expect(lateCheckDate("cancelled", events, today)).toBeNull();
  });
});

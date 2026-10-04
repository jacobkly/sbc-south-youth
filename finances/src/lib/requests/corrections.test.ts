import { describe, expect, it } from "vitest";
import {
  correctedPaidAt,
  correctionChanges,
  correctionSnapshot,
  correctRequestArgs,
  correctionReasonError,
  filesSummary,
  vendorList,
  type CorrectionSnapshot,
} from "./corrections";

const PAID_AT = "2026-01-15T20:00:00+00:00";

const before: CorrectionSnapshot = {
  type: "youth",
  purchase_date: "2026-01-10",
  description: "Request c001",
  event_name: null,
  no_receipt: false,
  no_receipt_reason: null,
  lines: [{ amount_cents: 1000, vendor: "Fake Store" }],
  paid_at: null,
  payment_method: null,
  payment_reference: null,
};

const paid: CorrectionSnapshot = { ...before, paid_at: PAID_AT, payment_method: "cash", payment_reference: "Envelope 3" };

describe("vendorList", () => {
  it("lists each vendor once, in order, keeping the first spelling", () => {
    expect(vendorList(["Fake Store", " other shop ", "fake store", null, "Other Shop"])).toBe("Fake Store, other shop");
  });

  it("is null without any vendors", () => {
    expect(vendorList([null, "  "])).toBeNull();
  });
});

describe("correctionChanges", () => {
  it("has nothing when nothing changed", () => {
    expect(correctionChanges(before, { ...before, lines: [{ amount_cents: 1000, vendor: "Fake Store" }] })).toBeNull();
    expect(correctionChanges(paid, { ...paid })).toBeNull();
  });

  it("records each changed field as it was and as it will be", () => {
    const after = { ...before, purchase_date: "2026-01-09", description: "Pizza for the lock-in", type: "cafe" as const };
    expect(correctionChanges(before, after)).toEqual({
      type: { from: "youth", to: "cafe" },
      purchase_date: { from: "2026-01-10", to: "2026-01-09" },
      description: { from: "Request c001", to: "Pizza for the lock-in" },
    });
  });

  it("works out the total and vendors from the receipts, like the database", () => {
    const after = { ...before, lines: [{ amount_cents: 1250, vendor: "Other Shop" }] };
    expect(correctionChanges(before, after)).toEqual({
      amount_cents: { from: 1000, to: 1250 },
      vendor: { from: "Fake Store", to: "Other Shop" },
    });
  });

  it("lists the receipts too once there's more than one", () => {
    const after = {
      ...before,
      lines: [
        { amount_cents: 1250, vendor: "Fake Store" },
        { amount_cents: 500, vendor: "Other Shop" },
      ],
    };
    expect(correctionChanges(before, after)).toEqual({
      amount_cents: { from: 1000, to: 1750 },
      vendor: { from: "Fake Store", to: "Fake Store, Other Shop" },
      lines: {
        from: [{ amount_cents: 1000, vendor: "Fake Store" }],
        to: [
          { amount_cents: 1250, vendor: "Fake Store" },
          { amount_cents: 500, vendor: "Other Shop" },
        ],
      },
    });
  });

  it("records a paid request's payment", () => {
    const after = { ...paid, paid_at: "2026-01-16T20:00:00.000Z", payment_method: "check" as const, payment_reference: "Check 1042" };
    expect(correctionChanges(paid, after)).toEqual({
      paid_at: { from: PAID_AT, to: "2026-01-16T20:00:00.000Z" },
      payment_method: { from: "cash", to: "check" },
      payment_reference: { from: "Envelope 3", to: "Check 1042" },
    });
  });
});

describe("filesSummary", () => {
  it("counts the files added and removed", () => {
    expect(filesSummary(0, 0)).toBeNull();
    expect(filesSummary(1, 0)).toBe("1 file added");
    expect(filesSummary(0, 2)).toBe("2 files removed");
    expect(filesSummary(2, 1)).toBe("2 files added, 1 removed");
  });
});

describe("correctedPaidAt", () => {
  const now = new Date("2026-10-03T19:00:00Z");

  it("keeps the exact time it was recorded when the date stays the same", () => {
    // 8 p.m. UTC on Jan 15 is noon that day in Los Angeles.
    expect(correctedPaidAt(PAID_AT, "2026-01-15", now)).toBe(PAID_AT);
  });

  it("uses noon on a new date, or now when the new date is today", () => {
    expect(correctedPaidAt(PAID_AT, "2026-01-16", now)).toBe("2026-01-16T20:00:00.000Z");
    expect(correctedPaidAt(PAID_AT, "2026-10-03", now)).toBe("2026-10-03T19:00:00.000Z");
  });
});

describe("correctionReasonError", () => {
  it("needs a reason, like the database", () => {
    expect(correctionReasonError("   ")).toBe("Say what was wrong.");
    expect(correctionReasonError("x".repeat(1001))).toBe("Keep the reason to 1,000 characters or fewer.");
    expect(correctionReasonError(` ${"x".repeat(1000)} `)).toBeNull();
  });
});

describe("correctionSnapshot", () => {
  it("compares the checked values the way the request is saved", () => {
    const input = {
      payee_id: "00000000-0000-4000-8000-00000000b001",
      type: "youth" as const,
      purchase_date: "2026-01-10",
      lines: [{ id: "00000000-0000-4000-8000-00000000f001", amount_cents: 1000, vendor: "Fake Store" }],
      amount_cents: 1000,
      description: "Request c001",
      event_name: null,
      no_receipt: false,
      no_receipt_reason: null,
    };
    expect(correctionSnapshot(input, null)).toEqual(before);
    const payment = { paid_at: PAID_AT, payment_method: "cash" as const, payment_reference: "Envelope 3" };
    expect(correctionSnapshot(input, payment)).toEqual(paid);
  });
});

describe("correctRequestArgs", () => {
  const input = {
    payee_id: "00000000-0000-4000-8000-00000000b001",
    type: "youth" as const,
    purchase_date: "2026-01-09",
    lines: [{ id: "00000000-0000-4000-8000-00000000f001", amount_cents: 1250, vendor: "Fake Store" }],
    amount_cents: 1250,
    description: "Pizza for the lock-in",
    event_name: null,
    no_receipt: false,
    no_receipt_reason: null,
  };

  it("leaves out the payee, which a correction can't change", () => {
    const args = correctRequestArgs("00000000-0000-4000-8000-00000000c001", input, null, "Wrong date");
    expect(args).not.toHaveProperty("p_payee_id");
    expect(args).toEqual({
      p_request_id: "00000000-0000-4000-8000-00000000c001",
      p_type: "youth",
      p_purchase_date: "2026-01-09",
      p_description: "Pizza for the lock-in",
      p_event_name: null,
      p_no_receipt: false,
      p_no_receipt_reason: null,
      p_lines: input.lines,
      p_paid_at: null,
      p_payment_method: null,
      p_payment_reference: null,
      p_reason: "Wrong date",
    });
  });

  it("sends a paid request's payment", () => {
    const payment = { paid_at: PAID_AT, payment_method: "check" as const, payment_reference: "Check 1042" };
    expect(correctRequestArgs("00000000-0000-4000-8000-00000000c002", input, payment, "Paid by check")).toMatchObject({
      p_paid_at: PAID_AT,
      p_payment_method: "check",
      p_payment_reference: "Check 1042",
    });
  });
});

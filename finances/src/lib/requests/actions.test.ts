import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database.types";
import {
  appErrorMessage,
  applyRequestAction,
  applySaveAction,
  availableActions,
  availableSaveOptions,
  blockedByReceiptRule,
  editReceiptError,
  requesterActions,
  requesterReceiptError,
  isWrongStatusError,
  lateSubmissionDays,
  needsExternalApprover,
  paidAtFor,
  saveActionErrorMessage,
  validateRequestAction,
  validateSaveOption,
  type RequestActionContext,
  type RequestActionValues,
  type SaveContext,
  type SaveOptionValues,
} from "./actions";

const REQUEST_ID = "00000000-0000-4000-8000-000000000001";

const values: SaveOptionValues = {
  option: "draft",
  external_approver: "",
  payment_method: "cash_app",
  payment_reference: "",
  paid_date: "2026-09-25",
};

const context: SaveContext = {
  today: "2026-09-25",
  purchaseDate: "2026-09-20",
  selfPayee: false,
  allowExternalApproval: true,
  receiptCount: 1,
  noReceipt: false,
};

describe("availableSaveOptions", () => {
  it("offers every option for someone else's reimbursement", () => {
    expect(availableSaveOptions({ selfPayee: false, allowExternalApproval: false })).toEqual([
      "draft",
      "submit",
      "approve",
      "paid",
    ]);
  });

  it("offers every option for your own while external approval is on", () => {
    expect(availableSaveOptions({ selfPayee: true, allowExternalApproval: true })).toHaveLength(4);
  });

  it("drops approving and recording paid for your own while external approval is off", () => {
    expect(availableSaveOptions({ selfPayee: true, allowExternalApproval: false })).toEqual(["draft", "submit"]);
  });
});

describe("needsExternalApprover", () => {
  const self = { selfPayee: true, allowExternalApproval: true };

  it("is needed only when approving or recording your own as paid", () => {
    expect(needsExternalApprover("approve", self)).toBe(true);
    expect(needsExternalApprover("paid", self)).toBe(true);
    expect(needsExternalApprover("draft", self)).toBe(false);
    expect(needsExternalApprover("submit", self)).toBe(false);
    expect(needsExternalApprover("approve", { ...self, selfPayee: false })).toBe(false);
  });
});

describe("validateSaveOption", () => {
  it("passes a draft and a submit through", () => {
    expect(validateSaveOption(values, context)).toEqual({ success: true, data: { option: "draft" } });
    expect(validateSaveOption({ ...values, option: "submit" }, context)).toEqual({
      success: true,
      data: { option: "submit" },
    });
  });

  it("lets a draft wait for its receipts, but nothing past a draft", () => {
    const none = { ...context, receiptCount: 0 };
    expect(validateSaveOption(values, none).success).toBe(true);
    for (const option of ["submit", "approve", "paid"] as const) {
      const result = validateSaveOption({ ...values, option }, none);
      expect(result.success ? {} : result.errors).toHaveProperty("receipts");
    }
    expect(validateSaveOption({ ...values, option: "submit" }, { ...none, noReceipt: true }).success).toBe(true);
  });

  it("records a payment with a trimmed reference and no approver for someone else", () => {
    const result = validateSaveOption(
      { ...values, option: "paid", payment_method: "check", payment_reference: "  1042 ", paid_date: "2026-09-22" },
      context,
    );
    expect(result).toEqual({
      success: true,
      data: {
        option: "paid",
        external_approver: null,
        payment_method: "check",
        payment_reference: "1042",
        paid_date: "2026-09-22",
      },
    });
  });

  it("stores a blank reference as null", () => {
    const result = validateSaveOption({ ...values, option: "paid", payment_reference: "   " }, context);
    expect(result.success && result.data.option === "paid" && result.data.payment_reference).toBeNull();
  });

  it("requires Approved by to approve or record your own as paid", () => {
    const self = { ...context, selfPayee: true };
    for (const option of ["approve", "paid"] as const) {
      const result = validateSaveOption({ ...values, option, external_approver: "  " }, self);
      expect(result).toEqual({ success: false, errors: { external_approver: "Enter who approved it." } });
    }
    expect(validateSaveOption({ ...values, option: "approve", external_approver: " Test Approver " }, self)).toEqual({
      success: true,
      data: { option: "approve", external_approver: "Test Approver" },
    });
  });

  it("drops a leftover Approved by when it isn't needed", () => {
    const result = validateSaveOption({ ...values, option: "approve", external_approver: "Test Approver" }, context);
    expect(result).toEqual({ success: true, data: { option: "approve", external_approver: null } });
  });

  it("checks the paid date", () => {
    const paidDateError = (paid_date: string, purchaseDate = context.purchaseDate) => {
      const result = validateSaveOption({ ...values, option: "paid", paid_date }, { ...context, purchaseDate });
      return result.success ? undefined : result.errors.paid_date;
    };
    expect(paidDateError("")).toBe("Enter the date it was paid.");
    expect(paidDateError("2026-02-30")).toBe("Enter a valid date.");
    expect(paidDateError("2026-09-26")).toBe("The paid date can't be in the future.");
    expect(paidDateError("2026-09-19")).toBe("The paid date can't be before the purchase date.");
    expect(paidDateError("2026-09-20")).toBeUndefined();
    // An unfinished purchase date is its own error, so the paid date isn't blamed for it.
    expect(paidDateError("2026-09-19", "")).toBeUndefined();
  });

  it("ignores the payment fields unless recording as paid", () => {
    const result = validateSaveOption({ ...values, option: "approve", paid_date: "", payment_reference: "x".repeat(201) }, context);
    expect(result.success).toBe(true);
  });

  it("limits the reference and approver lengths", () => {
    const result = validateSaveOption(
      { ...values, option: "paid", payment_reference: "x".repeat(201), external_approver: "x".repeat(101) },
      { ...context, selfPayee: true },
    );
    expect(result.success ? {} : result.errors).toEqual({
      payment_reference: "Keep the reference to 200 characters or fewer.",
      external_approver: "Keep the name to 100 characters or fewer.",
    });
  });
});

describe("paidAtFor", () => {
  it("uses the current time for a payment made today", () => {
    const now = new Date("2026-09-25T22:15:00Z");
    expect(paidAtFor("2026-09-25", now)).toBe("2026-09-25T22:15:00.000Z");
  });

  it("uses noon in LA for an earlier date", () => {
    // 11:30 PM PDT on Sep 25 is Sep 26 in UTC, but it's still the 25th in LA.
    const now = new Date("2026-09-26T06:30:00Z");
    expect(paidAtFor("2026-09-24", now)).toBe("2026-09-24T19:00:00.000Z");
    expect(paidAtFor("2026-09-25", now)).toBe("2026-09-26T06:30:00.000Z");
  });
});

describe("lateSubmissionDays", () => {
  it("warns only past the limit", () => {
    expect(lateSubmissionDays("2026-07-27", "2026-09-25", 60)).toBeNull();
    expect(lateSubmissionDays("2026-07-26", "2026-09-25", 60)).toBe(61);
  });

  it("stays quiet for a blank, invalid, or future date", () => {
    expect(lateSubmissionDays("", "2026-09-25", 60)).toBeNull();
    expect(lateSubmissionDays("2026-13-01", "2026-09-25", 60)).toBeNull();
    expect(lateSubmissionDays("2026-09-26", "2026-09-25", 60)).toBeNull();
  });
});

/** A stand-in for the Supabase client that records RPC calls. */
function fakeClient(error: object | null = null) {
  const rpc = vi.fn(async () => ({ data: null, error }));
  return { client: { rpc } as unknown as SupabaseClient<Database>, rpc };
}

describe("applySaveAction", () => {
  it("does nothing more for a draft", async () => {
    const { client, rpc } = fakeClient();
    expect(await applySaveAction(client, REQUEST_ID, { option: "draft" })).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("submits", async () => {
    const { client, rpc } = fakeClient();
    await applySaveAction(client, REQUEST_ID, { option: "submit" });
    expect(rpc).toHaveBeenCalledWith("submit_request", { p_request_id: REQUEST_ID });
  });

  it("approves, sending Approved by only when there is one", async () => {
    const { client, rpc } = fakeClient();
    await applySaveAction(client, REQUEST_ID, { option: "approve", external_approver: null });
    await applySaveAction(client, REQUEST_ID, { option: "approve", external_approver: "Test Approver" });
    expect(rpc).toHaveBeenNthCalledWith(1, "approve_request", {
      p_request_id: REQUEST_ID,
      p_external_approver: undefined,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "approve_request", {
      p_request_id: REQUEST_ID,
      p_external_approver: "Test Approver",
    });
  });

  it("records as paid with the method, reference, and paid time", async () => {
    const { client, rpc } = fakeClient();
    await applySaveAction(
      client,
      REQUEST_ID,
      {
        option: "paid",
        external_approver: null,
        payment_method: "cash_app",
        payment_reference: null,
        paid_date: "2026-09-01",
      },
      new Date("2026-09-25T18:00:00Z"),
    );
    expect(rpc).toHaveBeenCalledWith("record_as_paid", {
      p_request_id: REQUEST_ID,
      p_method: "cash_app",
      p_reference: "",
      p_paid_at: "2026-09-01T19:00:00.000Z",
      p_external_approver: undefined,
    });
  });

  it("returns the RPC's error", async () => {
    const error = { code: "55000", message: "Only a draft or submitted request can be approved." };
    const { client } = fakeClient(error);
    expect(await applySaveAction(client, REQUEST_ID, { option: "approve", external_approver: null })).toBe(error);
  });
});

describe("saveActionErrorMessage", () => {
  it("shows the app's own messages", () => {
    expect(
      saveActionErrorMessage("paid", {
        code: "23514",
        message: "This request is paid to you, so enter who approved it.",
      }),
    ).toBe(
      "The draft is saved, but it wasn't recorded as paid. This request is paid to you, so enter who approved it.",
    );
  });

  it("hides raw database and network errors", () => {
    const fallback = "The draft is saved, but it wasn't submitted. Check your connection and try again.";
    expect(
      saveActionErrorMessage("submit", {
        code: "23514",
        message: 'new row for relation "reimbursement_requests" violates check constraint "x"',
      }),
    ).toBe(fallback);
    expect(saveActionErrorMessage("submit", { code: "42501", message: "permission denied for function submit_request" })).toBe(
      fallback,
    );
    expect(saveActionErrorMessage("submit", { code: "PGRST301", message: "JWT expired." })).toBe(fallback);
    expect(saveActionErrorMessage("submit", { message: "TypeError: Failed to fetch" })).toBe(fallback);
    expect(saveActionErrorMessage("submit", null)).toBe(fallback);
  });
});

describe("availableActions", () => {
  const base: RequestActionContext = {
    status: "draft",
    selfPayee: false,
    enteredBySelf: true,
    allowExternalApproval: false,
  };

  it("offers each status's next steps", () => {
    expect(availableActions(base)).toEqual(["submit", "approve", "record_paid"]);
    expect(availableActions({ ...base, status: "submitted" })).toEqual(["approve", "request_info", "reject", "cancel"]);
    expect(availableActions({ ...base, status: "needs_info" })).toEqual(["submit", "reject", "cancel"]);
    expect(availableActions({ ...base, status: "approved" })).toEqual(["mark_paid", "unapprove"]);
    expect(availableActions({ ...base, status: "paid" })).toEqual(["unmark_paid"]);
  });

  it("offers nothing once rejected or cancelled", () => {
    expect(availableActions({ ...base, status: "rejected" })).toEqual([]);
    expect(availableActions({ ...base, status: "cancelled" })).toEqual([]);
  });

  it("lets only whoever entered it, or the payee, cancel", () => {
    const other = { ...base, status: "submitted" as const, enteredBySelf: false };
    expect(availableActions(other)).not.toContain("cancel");
    expect(availableActions({ ...other, selfPayee: true, allowExternalApproval: true })).toContain("cancel");
    expect(availableActions({ ...other, status: "needs_info" })).toEqual(["submit", "reject"]);
  });

  it("hides approving your own reimbursement unless external approval is on", () => {
    const own = { ...base, selfPayee: true };
    expect(availableActions(own)).toEqual(["submit"]);
    expect(availableActions({ ...own, status: "submitted" })).toEqual(["request_info", "reject", "cancel"]);
    expect(availableActions({ ...own, allowExternalApproval: true })).toEqual(["submit", "approve", "record_paid"]);
    // Paying out an approval that already happened is fine.
    expect(availableActions({ ...own, status: "approved" })).toEqual(["mark_paid", "unapprove"]);
  });
});

describe("blockedByReceiptRule", () => {
  it("blocks sending on a request with no receipt and no exception", () => {
    const none = { receiptCount: 0, noReceipt: false };
    expect(blockedByReceiptRule("submit", none)).toBe(true);
    expect(blockedByReceiptRule("approve", none)).toBe(true);
    expect(blockedByReceiptRule("record_paid", none)).toBe(true);
    expect(blockedByReceiptRule("reject", none)).toBe(false);
    expect(blockedByReceiptRule("submit", { receiptCount: 0, noReceipt: true })).toBe(false);
    expect(blockedByReceiptRule("submit", { receiptCount: 2, noReceipt: false })).toBe(false);
  });
});

describe("editReceiptError", () => {
  const none = { receiptCount: 0, noReceipt: false };

  it("lets a draft go without a receipt", () => {
    expect(editReceiptError("draft", none)).toBeUndefined();
  });

  it("keeps the receipt rule once it's out for review", () => {
    expect(editReceiptError("submitted", none)).toMatch(/Add a receipt/);
    expect(editReceiptError("needs_info", none)).toMatch(/Add a receipt/);
    expect(editReceiptError("submitted", { receiptCount: 0, noReceipt: true })).toBeUndefined();
    expect(editReceiptError("needs_info", { receiptCount: 1, noReceipt: false })).toBeUndefined();
  });
});

describe("requesterActions", () => {
  it("lets a requester send a draft", () => {
    expect(requesterActions("draft")).toEqual(["submit"]);
  });

  it("lets a requester take back a request before it's decided", () => {
    expect(requesterActions("submitted")).toEqual(["cancel"]);
    expect(requesterActions("needs_info")).toEqual(["submit", "cancel"]);
  });

  it("leaves decided and closed requests alone", () => {
    for (const status of ["approved", "paid", "rejected", "cancelled"] as const) {
      expect(requesterActions(status)).toEqual([]);
    }
  });
});

describe("requesterReceiptError", () => {
  const none = { receiptCount: 0, noReceipt: false };

  it("lets a draft wait for its receipt", () => {
    expect(requesterReceiptError(false, none)).toBeUndefined();
  });

  it("asks for a photo before sending", () => {
    expect(requesterReceiptError(true, none)).toBe("Add a photo of your receipt.");
    expect(requesterReceiptError(true, { receiptCount: 1, noReceipt: false })).toBeUndefined();
  });

  it("respects an owner's no-receipt exception", () => {
    expect(requesterReceiptError(true, { receiptCount: 0, noReceipt: true })).toBeUndefined();
  });
});

describe("validateRequestAction", () => {
  const blank: RequestActionValues = {
    note: "",
    external_approver: "",
    payment_method: "check",
    payment_reference: "",
    paid_date: "2026-09-25",
  };

  it("needs nothing more to submit or cancel", () => {
    expect(validateRequestAction("submit", blank, context)).toEqual({ success: true, data: { action: "submit" } });
    expect(validateRequestAction("cancel", blank, context)).toEqual({ success: true, data: { action: "cancel" } });
  });

  it("checks the receipt rule before sending it on", () => {
    const noReceipts = { ...context, receiptCount: 0 };
    expect(validateRequestAction("submit", blank, noReceipts)).toMatchObject({
      success: false,
      errors: { receipts: expect.any(String) },
    });
    expect(validateRequestAction("reject", { ...blank, note: "Duplicate." }, noReceipts).success).toBe(true);
  });

  it("requires a trimmed note of up to 1,000 characters", () => {
    for (const action of ["request_info", "reject", "unapprove", "unmark_paid"] as const) {
      expect(validateRequestAction(action, { ...blank, note: "   " }, context)).toEqual({
        success: false,
        errors: { note: "Add a note saying why." },
      });
      expect(validateRequestAction(action, { ...blank, note: "  Wrong amount.  " }, context)).toEqual({
        success: true,
        data: { action, note: "Wrong amount." },
      });
    }
    expect(validateRequestAction("reject", { ...blank, note: ` ${"x".repeat(1000)} ` }, context).success).toBe(true);
    expect(validateRequestAction("reject", { ...blank, note: "x".repeat(1001) }, context)).toEqual({
      success: false,
      errors: { note: "Keep the note to 1,000 characters or fewer." },
    });
  });

  it("marks paid with the payment fields and no approver", () => {
    expect(
      validateRequestAction("mark_paid", { ...blank, payment_reference: " 1042 ", external_approver: "Left over" }, context),
    ).toEqual({
      success: true,
      data: { action: "mark_paid", payment_method: "check", payment_reference: "1042", paid_date: "2026-09-25" },
    });
  });

  it("checks the paid date when marking or recording paid", () => {
    expect(validateRequestAction("mark_paid", { ...blank, paid_date: "2026-09-26" }, context)).toEqual({
      success: false,
      errors: { paid_date: "The paid date can't be in the future." },
    });
    expect(validateRequestAction("record_paid", { ...blank, paid_date: "2026-09-19" }, context)).toEqual({
      success: false,
      errors: { paid_date: "The paid date can't be before the purchase date." },
    });
    expect(validateRequestAction("approve", { ...blank, paid_date: "" }, context).success).toBe(true);
  });

  it("requires Approved by to approve or record your own as paid", () => {
    const own = { ...context, selfPayee: true };
    expect(validateRequestAction("approve", blank, own)).toEqual({
      success: false,
      errors: { external_approver: "Enter who approved it." },
    });
    expect(validateRequestAction("record_paid", { ...blank, external_approver: " Test Approver " }, own)).toEqual({
      success: true,
      data: {
        action: "record_paid",
        external_approver: "Test Approver",
        payment_method: "check",
        payment_reference: null,
        paid_date: "2026-09-25",
      },
    });
    expect(validateRequestAction("mark_paid", blank, own).success).toBe(true);
  });
});

describe("applyRequestAction", () => {
  const now = new Date("2026-09-25T18:00:00Z");

  it("sends each note action to its function", async () => {
    const { client, rpc } = fakeClient();
    await applyRequestAction(client, REQUEST_ID, { action: "request_info", note: "Need the receipt." });
    await applyRequestAction(client, REQUEST_ID, { action: "reject", note: "Duplicate." });
    await applyRequestAction(client, REQUEST_ID, { action: "unapprove", note: "Wrong amount." });
    await applyRequestAction(client, REQUEST_ID, { action: "unmark_paid", note: "Payment bounced." });
    expect(rpc.mock.calls).toEqual([
      ["request_info", { p_request_id: REQUEST_ID, p_note: "Need the receipt." }],
      ["reject_request", { p_request_id: REQUEST_ID, p_note: "Duplicate." }],
      ["unapprove_request", { p_request_id: REQUEST_ID, p_note: "Wrong amount." }],
      ["unmark_paid", { p_request_id: REQUEST_ID, p_note: "Payment bounced." }],
    ]);
  });

  it("cancels", async () => {
    const { client, rpc } = fakeClient();
    await applyRequestAction(client, REQUEST_ID, { action: "cancel" });
    expect(rpc).toHaveBeenCalledWith("cancel_request", { p_request_id: REQUEST_ID });
  });

  it("marks paid, leaving out a blank reference", async () => {
    const { client, rpc } = fakeClient();
    await applyRequestAction(
      client,
      REQUEST_ID,
      { action: "mark_paid", payment_method: "cash", payment_reference: null, paid_date: "2026-09-25" },
      now,
    );
    await applyRequestAction(
      client,
      REQUEST_ID,
      { action: "mark_paid", payment_method: "check", payment_reference: "1042", paid_date: "2026-09-24" },
      now,
    );
    expect(rpc).toHaveBeenNthCalledWith(1, "mark_paid", {
      p_request_id: REQUEST_ID,
      p_method: "cash",
      p_reference: undefined,
      p_paid_at: "2026-09-25T18:00:00.000Z",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "mark_paid", {
      p_request_id: REQUEST_ID,
      p_method: "check",
      p_reference: "1042",
      p_paid_at: "2026-09-24T19:00:00.000Z",
    });
  });
});

describe("appErrorMessage", () => {
  it("passes the app's sentences through and hides the rest", () => {
    const wrongStatus = { code: "55000", message: "Only an approved request can be marked paid." };
    expect(appErrorMessage(wrongStatus)).toBe(wrongStatus.message);
    expect(appErrorMessage({ code: "22023", message: "Add a note explaining why." })).toBe("Add a note explaining why.");
    expect(appErrorMessage({ code: "42501", message: "permission denied for table payees" })).toBeNull();
    expect(appErrorMessage({ message: "TypeError: Failed to fetch" })).toBeNull();
    expect(appErrorMessage(null)).toBeNull();
  });

  it("spots a request that changed since the page loaded", () => {
    expect(isWrongStatusError({ code: "55000", message: "x" })).toBe(true);
    expect(isWrongStatusError({ code: "42501", message: "x" })).toBe(false);
    expect(isWrongStatusError(null)).toBe(false);
  });
});

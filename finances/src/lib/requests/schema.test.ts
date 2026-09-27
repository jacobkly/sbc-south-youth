import { describe, expect, it } from "vitest";
import {
  errorsAfterChange,
  isFutureDateError,
  requestFieldErrors,
  requestSaveErrorMessage,
  requestSchema,
  saveRequestArgs,
  type RequestFormValues,
} from "./schema";
import type { RequestLineValues } from "./lines";

const TODAY = "2026-09-25";
const schema = requestSchema(TODAY);

const LINE_A = "00000000-0000-4000-8000-00000000f001";
const LINE_B = "00000000-0000-4000-8000-00000000f002";
const LINE_C = "00000000-0000-4000-8000-00000000f003";

const valid: RequestFormValues = {
  payee_id: "00000000-0000-4000-8000-000000000001",
  type: "youth",
  purchase_date: "2026-09-20",
  lines: [{ id: LINE_A, amount: "12.50", vendor: "Test Market" }],
  description: "Snacks for small group.",
  event_name: "",
  no_receipt: false,
  no_receipt_reason: "",
};

function withLine(line: Partial<RequestLineValues>): Pick<RequestFormValues, "lines"> {
  return { lines: [{ ...valid.lines[0], ...line }] };
}

function errorsFor(values: Partial<RequestFormValues>) {
  const input = { ...valid, ...values };
  const result = schema.safeParse(input);
  expect(result.success).toBe(false);
  return result.success ? {} : requestFieldErrors(result.error, input.lines);
}

describe("requestSchema", () => {
  it("converts the amount to cents and stores a blank event as null", () => {
    expect(schema.parse(valid)).toEqual({
      payee_id: valid.payee_id,
      type: "youth",
      purchase_date: "2026-09-20",
      lines: [{ id: LINE_A, amount_cents: 1250, vendor: "Test Market" }],
      amount_cents: 1250,
      description: "Snacks for small group.",
      event_name: null,
      no_receipt: false,
      no_receipt_reason: null,
    });
  });

  it("adds up several receipts in order, trimming each vendor", () => {
    const result = schema.parse({
      ...valid,
      lines: [
        { id: LINE_A, amount: "10.00", vendor: "Costco" },
        { id: LINE_B, amount: "15", vendor: " Target " },
        { id: LINE_C, amount: "$11", vendor: "  " },
      ],
    });
    expect(result.lines).toEqual([
      { id: LINE_A, amount_cents: 1000, vendor: "Costco" },
      { id: LINE_B, amount_cents: 1500, vendor: "Target" },
      { id: LINE_C, amount_cents: 1100, vendor: null },
    ]);
    expect(result.amount_cents).toBe(3600);
  });

  it("trims text and accepts dollar signs and commas", () => {
    const result = schema.parse({
      ...valid,
      ...withLine({ amount: " $1,234.5 ", vendor: "  Test Market " }),
      description: " Supplies. ",
      event_name: "  Test Retreat ",
    });
    expect(result).toMatchObject({
      lines: [{ id: LINE_A, amount_cents: 123450, vendor: "Test Market" }],
      amount_cents: 123450,
      description: "Supplies.",
      event_name: "Test Retreat",
    });
  });

  it("accepts today as the purchase date", () => {
    expect(schema.parse({ ...valid, purchase_date: TODAY }).purchase_date).toBe(TODAY);
  });

  it("requires the payee, type, amount, and date", () => {
    expect(
      errorsFor({
        payee_id: "",
        type: "",
        purchase_date: "",
        ...withLine({ amount: "", vendor: " " }),
        description: "",
        no_receipt: true,
        no_receipt_reason: " ",
      }),
    ).toEqual({
      payee_id: "Choose a payee.",
      type: "Choose Cafe or Youth.",
      purchase_date: "Enter the purchase date.",
      lines: { [LINE_A]: { amount: "Enter an amount." } },
    });
  });

  it("puts each receipt's errors under its id", () => {
    expect(
      errorsFor({
        lines: [
          { id: LINE_A, amount: "10.00", vendor: "Costco" },
          { id: LINE_B, amount: "", vendor: "v".repeat(101) },
          { id: LINE_C, amount: "abc", vendor: "" },
        ],
      }),
    ).toEqual({
      lines: {
        [LINE_B]: { amount: "Enter an amount.", vendor: "Keep the vendor to 100 characters or fewer." },
        [LINE_C]: { amount: "Enter a dollar amount, like 12.34." },
      },
    });
  });

  it("stores a blank vendor and description as null", () => {
    expect(schema.parse({ ...valid, ...withLine({ vendor: "  " }), description: "\n " })).toMatchObject({
      lines: [{ id: LINE_A, amount_cents: 1250, vendor: null }],
      description: null,
    });
  });

  it("lets the no-receipt exception go without a reason", () => {
    expect(schema.parse({ ...valid, no_receipt: true, no_receipt_reason: "  " })).toMatchObject({
      no_receipt: true,
      no_receipt_reason: null,
    });
  });

  it("keeps a trimmed reason only when there's no receipt", () => {
    expect(schema.parse({ ...valid, no_receipt: true, no_receipt_reason: " Lost it. " })).toMatchObject({
      no_receipt: true,
      no_receipt_reason: "Lost it.",
    });
    expect(schema.parse({ ...valid, no_receipt: false, no_receipt_reason: "Lost it." })).toMatchObject({
      no_receipt: false,
      no_receipt_reason: null,
    });
  });

  it.each([
    ["0", "Enter an amount more than $0."],
    ["$0.00", "Enter an amount more than $0."],
    ["12.345", "Use no more than 2 decimal places."],
    ["-5", "Enter a dollar amount, like 12.34."],
    ["abc", "Enter a dollar amount, like 12.34."],
    ["$", "Enter a dollar amount, like 12.34."],
    ["1000000.01", "Keep the amount to $1,000,000.00 or less."],
    ["99999999999", "Keep the amount to $1,000,000.00 or less."],
  ])("rejects the amount %j", (amount, message) => {
    expect(errorsFor(withLine({ amount }))).toEqual({ lines: { [LINE_A]: { amount: message } } });
  });

  it("accepts the largest allowed amount", () => {
    expect(schema.parse({ ...valid, ...withLine({ amount: "1000000" }) }).amount_cents).toBe(100_000_000);
  });

  it("keeps the total to the largest allowed amount", () => {
    expect(
      errorsFor({
        lines: [
          { id: LINE_A, amount: "600000", vendor: "" },
          { id: LINE_B, amount: "400000.01", vendor: "" },
        ],
      }),
    ).toEqual({ total: "Keep the total to $1,000,000.00 or less." });

    const atLimit = schema.parse({
      ...valid,
      lines: [
        { id: LINE_A, amount: "600000", vendor: "" },
        { id: LINE_B, amount: "400000", vendor: "" },
      ],
    });
    expect(atLimit.amount_cents).toBe(100_000_000);
  });

  it("shows the total error next to the other fields' errors", () => {
    expect(
      errorsFor({
        payee_id: "",
        lines: [
          { id: LINE_A, amount: "600000", vendor: "" },
          { id: LINE_B, amount: "400000.01", vendor: "" },
        ],
      }),
    ).toEqual({ payee_id: "Choose a payee.", total: "Keep the total to $1,000,000.00 or less." });
  });

  it("allows up to 10 receipts", () => {
    const lines = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: `00000000-0000-4000-8000-0000000010${String(i).padStart(2, "0")}`,
        amount: "1",
        vendor: "",
      }));

    expect(schema.parse({ ...valid, lines: lines(10) }).amount_cents).toBe(1000);
    expect(errorsFor({ lines: lines(11) })).toEqual({ total: "A request can have up to 10 receipts." });
  });

  it("needs at least one receipt", () => {
    expect(errorsFor({ lines: [] })).toEqual({ total: "Enter an amount." });
  });

  it.each([
    ["2026-09-26", "The purchase date can't be in the future."],
    ["1999-12-31", "Enter a date in 2000 or later."],
    ["2026-02-30", "Enter a valid date."],
    ["09/20/2026", "Enter a valid date."],
  ])("rejects the purchase date %j", (purchase_date, message) => {
    expect(errorsFor({ purchase_date })).toEqual({ purchase_date: message });
  });

  it("rejects a missing or unknown type", () => {
    expect(errorsFor({ type: "other" as RequestFormValues["type"] })).toEqual({ type: "Choose Cafe or Youth." });
  });

  it("enforces the text length limits", () => {
    expect(
      errorsFor({
        ...withLine({ vendor: "v".repeat(101) }),
        description: "d".repeat(1001),
        event_name: "e".repeat(101),
        no_receipt: true,
        no_receipt_reason: "r".repeat(501),
      }),
    ).toEqual({
      lines: { [LINE_A]: { vendor: "Keep the vendor to 100 characters or fewer." } },
      description: "Keep the description to 1,000 characters or fewer.",
      event_name: "Keep the event name to 100 characters or fewer.",
      no_receipt_reason: "Keep the reason to 500 characters or fewer.",
    });
  });

  it("accepts text at the length limits", () => {
    const result = schema.safeParse({
      ...valid,
      ...withLine({ vendor: "v".repeat(100) }),
      description: "d".repeat(1000),
      event_name: "e".repeat(100),
      no_receipt: true,
      no_receipt_reason: "r".repeat(500),
    });
    expect(result.success).toBe(true);
  });
});

describe("errorsAfterChange", () => {
  const lines = [
    { id: LINE_A, amount: "", vendor: "" },
    { id: LINE_B, amount: "abc", vendor: "v".repeat(101) },
  ];
  const errors = {
    payee_id: "Choose a payee.",
    total: "Keep the total to $1,000,000.00 or less.",
    receipts: "Add a receipt.",
    lines: {
      [LINE_A]: { amount: "Enter an amount." },
      [LINE_B]: { amount: "Enter a dollar amount, like 12.34.", vendor: "Keep the vendor to 100 characters or fewer." },
    },
  };

  it("clears a field's own error", () => {
    expect(errorsAfterChange(errors, "payee_id", "", "x")).toEqual({ ...errors, payee_id: undefined });
  });

  it("clears the receipt and reason errors when the no-receipt switch changes", () => {
    expect(errorsAfterChange({ ...errors, no_receipt_reason: "Too long." }, "no_receipt", false, true)).toEqual({
      ...errors,
      receipts: undefined,
      no_receipt_reason: undefined,
    });
  });

  it("clears only the receipt field that changed, and the total with an amount", () => {
    const after = [lines[0], { ...lines[1], amount: "12" }];
    expect(errorsAfterChange(errors, "lines", lines, after)).toEqual({
      ...errors,
      total: undefined,
      lines: {
        [LINE_A]: { amount: "Enter an amount." },
        [LINE_B]: { vendor: "Keep the vendor to 100 characters or fewer." },
      },
    });
  });

  it("keeps the total's error when only a vendor changes", () => {
    const after = [{ ...lines[0], vendor: "Costco" }, lines[1]];
    expect(errorsAfterChange(errors, "lines", lines, after)).toEqual(errors);
  });

  it("keeps the total's error when an amount is only tidied", () => {
    const before = [{ id: LINE_A, amount: "$600,000", vendor: "" }, { id: LINE_B, amount: "500000", vendor: "" }];
    const after = [{ ...before[0], amount: "600000.00" }, before[1]];
    const tooMuch = { total: "Keep the total to $1,000,000.00 or less." };
    expect(errorsAfterChange(tooMuch, "lines", before, after)).toEqual({ ...tooMuch, lines: {} });
  });

  it("drops a removed receipt's errors, and the total's", () => {
    expect(errorsAfterChange(errors, "lines", lines, [lines[0]])).toEqual({
      ...errors,
      total: undefined,
      lines: { [LINE_A]: { amount: "Enter an amount." } },
    });
  });
});

describe("saveRequestArgs", () => {
  it("passes the checked values and receipts to save_request", () => {
    const input = schema.parse({
      ...valid,
      lines: [
        { id: LINE_A, amount: "10.00", vendor: "Costco" },
        { id: LINE_B, amount: "15.00", vendor: "" },
      ],
    });

    expect(saveRequestArgs(null, input)).toEqual({
      p_request_id: null,
      p_payee_id: valid.payee_id,
      p_type: "youth",
      p_purchase_date: "2026-09-20",
      p_description: "Snacks for small group.",
      p_event_name: null,
      p_no_receipt: false,
      p_no_receipt_reason: null,
      p_lines: [
        { id: LINE_A, amount_cents: 1000, vendor: "Costco" },
        { id: LINE_B, amount_cents: 1500, vendor: null },
      ],
    });
  });

  it("names the request when editing, so saving again updates it", () => {
    const input = schema.parse(valid);
    const id = "00000000-0000-4000-8000-00000000c001";
    expect(saveRequestArgs(id, input).p_request_id).toBe(id);
  });
});

describe("isFutureDateError", () => {
  it("spots the database's future date error", () => {
    expect(isFutureDateError({ code: "22023", message: "The purchase date can't be in the future." })).toBe(true);
  });

  it("ignores other errors with the same code", () => {
    expect(isFutureDateError({ code: "22023", message: "A request can have at most 10 receipts." })).toBe(false);
    expect(isFutureDateError({ code: "23514", message: "The purchase date can't be in the future." })).toBe(false);
    expect(isFutureDateError(null)).toBe(false);
  });
});

describe("requestSaveErrorMessage", () => {
  it("maps known database errors to plain messages", () => {
    expect(requestSaveErrorMessage({ code: "42501" })).toBe("You don't have permission to save requests.");
    expect(requestSaveErrorMessage({ code: "PGRST116" })).toBe("You don't have permission to save requests.");
    expect(requestSaveErrorMessage({ code: "23503" })).toBe("That payee couldn't be found. Choose the payee again.");
  });

  it("shows the database's own sentences, like a receipt that's too big", () => {
    expect(requestSaveErrorMessage({ code: "22023", message: "The purchase date can't be in the future." })).toBe(
      "The purchase date can't be in the future.",
    );
    expect(requestSaveErrorMessage({ code: "23514", message: "The total can't be more than $1,000,000." })).toBe(
      "The total can't be more than $1,000,000.",
    );
    expect(
      requestSaveErrorMessage({ code: "55000", message: "Remove a receipt's files before removing the receipt." }),
    ).toBe("Remove a receipt's files before removing the receipt.");
  });

  it("falls back to a generic message", () => {
    expect(requestSaveErrorMessage({ code: "XX000" })).toBe(
      "Couldn't save the request. Check your connection and try again.",
    );
    expect(
      requestSaveErrorMessage({ code: "23514", message: 'new row violates check constraint "purchase_date_check"' }),
    ).toBe("Couldn't save the request. Check your connection and try again.");
    expect(requestSaveErrorMessage(null)).toBe("Couldn't save the request. Check your connection and try again.");
  });
});

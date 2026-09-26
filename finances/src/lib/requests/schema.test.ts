import { describe, expect, it } from "vitest";
import { requestFieldErrors, requestSaveErrorMessage, requestSchema, type RequestFormValues } from "./schema";

const TODAY = "2026-09-25";
const schema = requestSchema(TODAY);

const valid: RequestFormValues = {
  payee_id: "00000000-0000-4000-8000-000000000001",
  type: "youth",
  amount: "12.50",
  purchase_date: "2026-09-20",
  vendor: "Test Market",
  description: "Snacks for small group.",
  event_name: "",
  no_receipt: false,
  no_receipt_reason: "",
};

function errorsFor(values: Partial<RequestFormValues>) {
  const result = schema.safeParse({ ...valid, ...values });
  expect(result.success).toBe(false);
  return result.success ? {} : requestFieldErrors(result.error);
}

describe("requestSchema", () => {
  it("converts the amount to cents and stores a blank event as null", () => {
    expect(schema.parse(valid)).toEqual({
      payee_id: valid.payee_id,
      type: "youth",
      amount_cents: 1250,
      purchase_date: "2026-09-20",
      vendor: "Test Market",
      description: "Snacks for small group.",
      event_name: null,
      no_receipt: false,
      no_receipt_reason: null,
    });
  });

  it("trims text and accepts dollar signs and commas", () => {
    const result = schema.parse({
      ...valid,
      amount: " $1,234.5 ",
      vendor: "  Test Market ",
      description: " Supplies. ",
      event_name: "  Test Retreat ",
    });
    expect(result).toMatchObject({
      amount_cents: 123450,
      vendor: "Test Market",
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
        amount: "",
        purchase_date: "",
        vendor: " ",
        description: "",
        no_receipt: true,
        no_receipt_reason: " ",
      }),
    ).toEqual({
      payee_id: "Choose a payee.",
      type: "Choose Cafe or Youth.",
      amount: "Enter an amount.",
      purchase_date: "Enter the purchase date.",
      no_receipt_reason: "Say why there's no receipt.",
    });
  });

  it("stores a blank vendor and description as null", () => {
    expect(schema.parse({ ...valid, vendor: "  ", description: "\n " })).toMatchObject({
      vendor: null,
      description: null,
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
    expect(errorsFor({ amount })).toEqual({ amount: message });
  });

  it("accepts the largest allowed amount", () => {
    expect(schema.parse({ ...valid, amount: "1000000" }).amount_cents).toBe(100_000_000);
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
        vendor: "v".repeat(101),
        description: "d".repeat(1001),
        event_name: "e".repeat(101),
        no_receipt: true,
        no_receipt_reason: "r".repeat(501),
      }),
    ).toEqual({
      vendor: "Keep the vendor to 100 characters or fewer.",
      description: "Keep the description to 1,000 characters or fewer.",
      event_name: "Keep the event name to 100 characters or fewer.",
      no_receipt_reason: "Keep the reason to 500 characters or fewer.",
    });
  });

  it("accepts text at the length limits", () => {
    const result = schema.safeParse({
      ...valid,
      vendor: "v".repeat(100),
      description: "d".repeat(1000),
      event_name: "e".repeat(100),
      no_receipt: true,
      no_receipt_reason: "r".repeat(500),
    });
    expect(result.success).toBe(true);
  });
});

describe("requestSaveErrorMessage", () => {
  it("maps known database errors to plain messages", () => {
    expect(requestSaveErrorMessage({ code: "22023" })).toBe("The purchase date can't be in the future.");
    expect(requestSaveErrorMessage({ code: "42501" })).toBe("You don't have permission to save requests.");
    expect(requestSaveErrorMessage({ code: "PGRST116" })).toBe("You don't have permission to save requests.");
    expect(requestSaveErrorMessage({ code: "23503" })).toBe("That payee couldn't be found. Choose the payee again.");
  });

  it("falls back to a generic message", () => {
    expect(requestSaveErrorMessage({ code: "XX000" })).toBe(
      "Couldn't save the request. Check your connection and try again.",
    );
    expect(requestSaveErrorMessage(null)).toBe("Couldn't save the request. Check your connection and try again.");
  });
});

import { describe, expect, it } from "vitest";
import { DUPLICATE_EMAIL_MESSAGE, payeeFieldErrors, payeeSaveErrorMessage, payeeSchema } from "./schema";

const blank = { full_name: "", email: "", payment_handle: "", notes: "" };

describe("payeeSchema", () => {
  it("trims values and stores blanks as null", () => {
    const result = payeeSchema.parse({
      full_name: "  Test Person  ",
      email: "  ",
      payment_handle: "",
      notes: " ",
    });
    expect(result).toEqual({ full_name: "Test Person", email: null, payment_handle: null, notes: null });
  });

  it("keeps optional values when given", () => {
    const result = payeeSchema.parse({
      full_name: "Test Person",
      email: " test.person@example.com ",
      payment_handle: "@test-handle",
      notes: "Pays for snacks.",
    });
    expect(result).toEqual({
      full_name: "Test Person",
      email: "test.person@example.com",
      payment_handle: "@test-handle",
      notes: "Pays for snacks.",
    });
  });

  it("requires a name", () => {
    const result = payeeSchema.safeParse({ ...blank, full_name: "   " });
    expect(result.success).toBe(false);
    if (!result.success) expect(payeeFieldErrors(result.error)).toEqual({ full_name: "Enter a name." });
  });

  it("rejects an invalid email", () => {
    const result = payeeSchema.safeParse({ ...blank, full_name: "Test Person", email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(payeeFieldErrors(result.error).email).toBe("Enter a valid email, or leave it blank.");
    }
  });

  it("enforces the database length limits", () => {
    const result = payeeSchema.safeParse({
      full_name: "a".repeat(101),
      email: "",
      payment_handle: "b".repeat(101),
      notes: "c".repeat(1001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(payeeFieldErrors(result.error)).sort()).toEqual(["full_name", "notes", "payment_handle"]);
    }
  });

  it("accepts values right at the limits", () => {
    const result = payeeSchema.safeParse({
      full_name: "a".repeat(100),
      email: "",
      payment_handle: "b".repeat(100),
      notes: "c".repeat(1000),
    });
    expect(result.success).toBe(true);
  });
});

describe("payeeSaveErrorMessage", () => {
  it("explains a duplicate email", () => {
    expect(payeeSaveErrorMessage({ code: "23505" })).toBe(DUPLICATE_EMAIL_MESSAGE);
  });

  it("explains a blocked write", () => {
    expect(payeeSaveErrorMessage({ code: "42501" })).toBe("You don't have permission to change payees.");
    expect(payeeSaveErrorMessage({ code: "PGRST116" })).toBe("You don't have permission to change payees.");
  });

  it("falls back to a generic message", () => {
    expect(payeeSaveErrorMessage({ code: "08006" })).toMatch(/Couldn't save the payee/);
    expect(payeeSaveErrorMessage(null)).toMatch(/Couldn't save the payee/);
  });
});

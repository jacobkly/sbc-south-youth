import { describe, expect, it } from "vitest";
import {
  incomeDeleteErrorMessage,
  incomeSaveErrorMessage,
  isAlreadySavedError,
  isIncomeDateError,
  youthIncomeFieldErrors,
  youthIncomeSchema,
  type YouthIncomeFormValues,
} from "./schema";

const TODAY = "2026-10-05";

function tithe(values: Partial<YouthIncomeFormValues> = {}): YouthIncomeFormValues {
  return { kind: "tithe", amount: "25", received_on: "2026-10-04", method: "cash_app", event_name: "", ...values };
}

function errorsFor(values: YouthIncomeFormValues) {
  const result = youthIncomeSchema(TODAY).safeParse(values);
  if (result.success) throw new Error("Expected the values to be turned down.");
  return youthIncomeFieldErrors(result.error);
}

describe("youthIncomeSchema", () => {
  it("turns a tithe into saved values", () => {
    expect(youthIncomeSchema(TODAY).parse(tithe({ amount: "$1,234.5" }))).toEqual({
      kind: "tithe",
      amount_cents: 123450,
      received_on: "2026-10-04",
      method: "cash_app",
      event_name: null,
    });
  });

  it("keeps an event's name, trimmed", () => {
    const saved = youthIncomeSchema(TODAY).parse(
      tithe({ kind: "event", amount: "380", method: "cash", event_name: "  Bake sale  " }),
    );
    expect(saved).toMatchObject({ kind: "event", amount_cents: 38000, method: "cash", event_name: "Bake sale" });
  });

  it("saves an event without a name", () => {
    expect(youthIncomeSchema(TODAY).parse(tithe({ kind: "event", event_name: "   " })).event_name).toBeNull();
  });

  it("saves an event whose money came in more than one way with no method", () => {
    expect(youthIncomeSchema(TODAY).parse(tithe({ kind: "event", method: "mixed" })).method).toBeNull();
  });

  it("drops a name left over from switching an event to a tithe", () => {
    expect(youthIncomeSchema(TODAY).parse(tithe({ event_name: "Bake sale" })).event_name).toBeNull();
  });

  it("asks for an amount more than $0", () => {
    expect(errorsFor(tithe({ amount: "" })).amount).toBe("Enter an amount.");
    expect(errorsFor(tithe({ amount: "0.00" })).amount).toBe("Enter an amount more than $0.");
    expect(errorsFor(tithe({ amount: "12.345" })).amount).toBe("Use no more than 2 decimal places.");
    expect(errorsFor(tithe({ amount: "abc" })).amount).toBe("Enter a dollar amount, like 12.34.");
  });

  it("caps the amount at $1,000,000", () => {
    expect(youthIncomeSchema(TODAY).safeParse(tithe({ amount: "1000000" })).success).toBe(true);
    expect(errorsFor(tithe({ amount: "1000000.01" })).amount).toBe("Keep the amount to $1,000,000.00 or less.");
  });

  it("takes today, but not a future date or one before 2000", () => {
    expect(youthIncomeSchema(TODAY).safeParse(tithe({ received_on: TODAY })).success).toBe(true);
    expect(errorsFor(tithe({ received_on: "2026-10-06" })).received_on).toBe("The date can't be in the future.");
    expect(errorsFor(tithe({ received_on: "1999-12-31" })).received_on).toBe("Enter a date in 2000 or later.");
    expect(errorsFor(tithe({ received_on: "" })).received_on).toBe("Enter the date.");
    expect(errorsFor(tithe({ received_on: "2026-02-30" })).received_on).toBe("Enter a valid date.");
  });

  it("needs to know how a tithe came in", () => {
    expect(errorsFor(tithe({ method: "" })).method).toBe("Choose how the tithe came in.");
    expect(errorsFor(tithe({ method: "mixed" })).method).toBe("Choose how the tithe came in.");
  });

  it("needs a method or Mixed for an event", () => {
    expect(errorsFor(tithe({ kind: "event", method: "" })).method).toBe("Choose how the money came in.");
  });

  it("keeps an event's name to 100 characters", () => {
    expect(youthIncomeSchema(TODAY).safeParse(tithe({ kind: "event", event_name: "a".repeat(100) })).success).toBe(
      true,
    );
    expect(errorsFor(tithe({ kind: "event", event_name: "a".repeat(101) })).event_name).toBe(
      "Keep the name to 100 characters or fewer.",
    );
  });
});

describe("income errors", () => {
  it("shows the database's own sentences", () => {
    const error = { code: "22023", message: "Choose how the tithe came in." };
    expect(incomeSaveErrorMessage(error)).toBe("Choose how the tithe came in.");
  });

  it("puts a future date next to the date field", () => {
    expect(isIncomeDateError({ code: "22023", message: "The date can't be in the future." })).toBe(true);
    expect(isIncomeDateError({ code: "22023", message: "Only an event can have a name." })).toBe(false);
  });

  it("explains a refused write without the raw database message", () => {
    const error = { code: "42501", message: 'new row violates row-level security policy for table "youth_income"' };
    expect(incomeSaveErrorMessage(error)).toBe("You don't have permission to change income.");
    expect(incomeDeleteErrorMessage(error)).toBe("You don't have permission to change income.");
  });

  it("says when the entry is gone", () => {
    expect(incomeSaveErrorMessage({ code: "PGRST116" })).toBe("That entry isn't there anymore. It may have been deleted.");
  });

  it("falls back to a plain message", () => {
    expect(incomeSaveErrorMessage(null)).toBe("Couldn't save it. Check your connection and try again.");
    expect(incomeDeleteErrorMessage({ code: "08006" })).toBe("Couldn't delete it. Check your connection and try again.");
  });

  it("treats a repeated add as already saved, since the app picks the id", () => {
    expect(isAlreadySavedError({ code: "23505" })).toBe(true);
    expect(isAlreadySavedError({ code: "22023" })).toBe(false);
    expect(isAlreadySavedError(null)).toBe(false);
  });
});

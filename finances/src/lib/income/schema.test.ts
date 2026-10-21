import { describe, expect, it } from "vitest";
import {
  cafePaybackFieldErrors,
  cafePaybackSchema,
  cafeWeekFieldErrors,
  cafeWeekSchema,
  incomeDeleteErrorMessage,
  incomeSaveErrorMessage,
  isAlreadySavedError,
  isIncomeDateError,
  parseSalesToCents,
  youthIncomeFieldErrors,
  youthIncomeSchema,
  type CafePaybackFormValues,
  type CafeWeekFormValues,
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

  it("doesn't treat a cafe week someone else entered as already saved", () => {
    const error = { code: "23505", message: "That week already has its sales. Open it to change them." };
    expect(isAlreadySavedError(error)).toBe(false);
    expect(incomeSaveErrorMessage(error)).toBe("That week already has its sales. Open it to change them.");
  });
});

function week(values: Partial<CafeWeekFormValues> = {}): CafeWeekFormValues {
  return {
    week_ending: "2026-10-04",
    sales: "640",
    discounts: "",
    tips: "",
    fees: "",
    returns: "",
    gift_card_sales: "",
    gift_card_redeemed: "",
    taxes: "",
    note: "",
    ...values,
  };
}

function cafeErrorsFor(values: CafeWeekFormValues) {
  const result = cafeWeekSchema(TODAY).safeParse(values);
  if (result.success) throw new Error("Expected the values to be turned down.");
  return cafeWeekFieldErrors(result.error);
}

describe("cafeWeekSchema", () => {
  it("turns a week into saved values", () => {
    expect(cafeWeekSchema(TODAY).parse(week({ sales: "$1,234.5", note: "  Closed early for camp  " }))).toEqual({
      week_ending: "2026-10-04",
      sales_cents: 123450,
      returns_cents: 0,
      discounts_cents: 0,
      gift_card_sales_cents: 0,
      gift_card_redeemed_cents: 0,
      taxes_cents: 0,
      tips_cents: 0,
      fees_cents: 0,
      note: "Closed early for camp",
    });
  });

  it("reads each of Square's lines", () => {
    const values = week({
      discounts: "98.25",
      tips: "$41.10",
      fees: "16.45",
      returns: "12",
      gift_card_sales: "50",
      gift_card_redeemed: "25.00",
      taxes: "0",
    });
    expect(cafeWeekSchema(TODAY).parse(values)).toMatchObject({
      discounts_cents: 9825,
      tips_cents: 4110,
      fees_cents: 1645,
      returns_cents: 1200,
      gift_card_sales_cents: 5000,
      gift_card_redeemed_cents: 2500,
      taxes_cents: 0,
    });
  });

  it("says which line isn't an amount", () => {
    expect(cafeErrorsFor(week({ tips: "abc" })).tips).toBe("Enter a dollar amount, like 12.34.");
    expect(cafeErrorsFor(week({ fees: "1000000.01" })).fees).toBe("Keep the amount to $1,000,000.00 or less.");
    expect(cafeErrorsFor(week({ returns: "-5" }))).toHaveProperty("returns");
  });

  it("saves no note as null", () => {
    expect(cafeWeekSchema(TODAY).parse(week({ note: "   " })).note).toBeNull();
  });

  it("takes $0 for a week the cafe was closed", () => {
    expect(cafeWeekSchema(TODAY).parse(week({ sales: "0" })).sales_cents).toBe(0);
    expect(cafeWeekSchema(TODAY).parse(week({ sales: "$0.00" })).sales_cents).toBe(0);
  });

  it("asks for the sales, or 0", () => {
    expect(cafeErrorsFor(week({ sales: "" })).sales).toBe("Enter the sales, or 0 if the cafe was closed.");
    expect(cafeErrorsFor(week({ sales: "abc" })).sales).toBe("Enter a dollar amount, like 12.34.");
    expect(cafeErrorsFor(week({ sales: "0.001" })).sales).toBe("Use no more than 2 decimal places.");
    expect(cafeErrorsFor(week({ sales: "1000000.01" })).sales).toBe("Keep the amount to $1,000,000.00 or less.");
  });

  it("takes this week before it ends, but not a week that hasn't started", () => {
    expect(cafeWeekSchema(TODAY).safeParse(week({ week_ending: "2026-10-11" })).success).toBe(true);
    expect(cafeErrorsFor(week({ week_ending: "2026-10-18" })).week_ending).toBe("That week hasn't started yet.");
  });

  it("needs the Sunday that ends a week, in 2000 or later", () => {
    expect(cafeErrorsFor(week({ week_ending: "2026-10-05" })).week_ending).toBe("Choose a week.");
    expect(cafeErrorsFor(week({ week_ending: "" })).week_ending).toBe("Choose a week.");
    expect(cafeErrorsFor(week({ week_ending: "1999-12-26" })).week_ending).toBe("Choose a week in 2000 or later.");
  });

  it("keeps the note to 500 characters", () => {
    expect(cafeWeekSchema(TODAY).safeParse(week({ note: "a".repeat(500) })).success).toBe(true);
    expect(cafeErrorsFor(week({ note: "a".repeat(501) })).note).toBe("Keep the note to 500 characters or fewer.");
  });
});

describe("parseSalesToCents", () => {
  it("reads $0 as a real amount", () => {
    expect(parseSalesToCents("0")).toBe(0);
    expect(parseSalesToCents(".00")).toBe(0);
    expect(parseSalesToCents("$0")).toBe(0);
  });

  it("reads other amounts like any other", () => {
    expect(parseSalesToCents("$1,234.5")).toBe(123450);
    expect(parseSalesToCents("")).toBeNull();
    expect(parseSalesToCents("abc")).toBeNull();
    expect(parseSalesToCents("0.001")).toBeNull();
  });
});

function payback(values: Partial<CafePaybackFormValues> = {}): CafePaybackFormValues {
  return {
    kind: "discounts",
    quarter_start: "2026-07-01",
    received_on: "2026-10-02",
    amount: "120",
    note: "",
    ...values,
  };
}

function paybackErrorsFor(values: CafePaybackFormValues) {
  const result = cafePaybackSchema(TODAY).safeParse(values);
  if (result.success) throw new Error("Expected the values to be turned down.");
  return cafePaybackFieldErrors(result.error);
}

describe("cafePaybackSchema", () => {
  it("turns a payback into saved values", () => {
    expect(cafePaybackSchema(TODAY).parse(payback({ amount: "$1,234.5", note: "  By check  " }))).toEqual({
      kind: "discounts",
      quarter_start: "2026-07-01",
      received_on: "2026-10-02",
      amount_cents: 123450,
      note: "By check",
    });
  });

  it("saves no note as null", () => {
    expect(cafePaybackSchema(TODAY).parse(payback({ note: "   " })).note).toBeNull();
  });

  it("keeps what the payback was for", () => {
    expect(cafePaybackSchema(TODAY).parse(payback({ kind: "gift_cards" })).kind).toBe("gift_cards");
    expect(paybackErrorsFor(payback({ kind: "" as never })).kind).toBe("Choose what it was for.");
  });

  it("asks for an amount more than $0, up to $1,000,000", () => {
    expect(paybackErrorsFor(payback({ amount: "" })).amount).toBe("Enter an amount.");
    expect(paybackErrorsFor(payback({ amount: "0" })).amount).toBeDefined();
    expect(paybackErrorsFor(payback({ amount: "1000000.01" })).amount).toBe("Keep the amount to $1,000,000.00 or less.");
  });

  it("takes this quarter, but not one that hasn't started", () => {
    expect(cafePaybackSchema(TODAY).safeParse(payback({ quarter_start: "2026-10-01" })).success).toBe(true);
    expect(paybackErrorsFor(payback({ quarter_start: "2027-01-01" })).quarter_start).toBe(
      "That quarter hasn't started yet.",
    );
  });

  it("needs the first day of a quarter, in 2000 or later", () => {
    expect(paybackErrorsFor(payback({ quarter_start: "2026-08-01" })).quarter_start).toBe("Choose a quarter.");
    expect(paybackErrorsFor(payback({ quarter_start: "" })).quarter_start).toBe("Choose a quarter.");
    expect(paybackErrorsFor(payback({ quarter_start: "1999-10-01" })).quarter_start).toBe(
      "Choose a quarter in 2000 or later.",
    );
  });

  it("takes today, but not a future date or one before 2000", () => {
    expect(cafePaybackSchema(TODAY).safeParse(payback({ received_on: TODAY })).success).toBe(true);
    expect(paybackErrorsFor(payback({ received_on: "2026-10-06" })).received_on).toBe("The date can't be in the future.");
    expect(paybackErrorsFor(payback({ received_on: "1999-12-31" })).received_on).toBe("Enter a date in 2000 or later.");
    expect(paybackErrorsFor(payback({ received_on: "" })).received_on).toBe("Enter the date.");
  });

  it("keeps the note to 500 characters", () => {
    expect(cafePaybackSchema(TODAY).safeParse(payback({ note: "a".repeat(500) })).success).toBe(true);
    expect(paybackErrorsFor(payback({ note: "a".repeat(501) })).note).toBe("Keep the note to 500 characters or fewer.");
  });
});

import { describe, expect, it } from "vitest";
import { MAX_CENTS, centsToDecimal, formatCents, parseAmountToCents } from "./money";

describe("formatCents", () => {
  it("formats cents as USD", () => {
    expect(formatCents(123456)).toBe("$1,234.56");
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(0)).toBe("$0.00");
  });

  it("formats negative totals", () => {
    expect(formatCents(-2500)).toBe("-$25.00");
  });
});

describe("parseAmountToCents", () => {
  it.each([
    ["12", 1200],
    ["12.5", 1250],
    ["12.50", 1250],
    ["12.", 1200],
    [".99", 99],
    ["0.01", 1],
    ["$1,234.56", 123456],
    [" $ 45.00 ", 4500],
    ["007.10", 710],
  ])("parses %j as %i cents", (input, cents) => {
    expect(parseAmountToCents(input)).toBe(cents);
  });

  it.each([
    [""],
    ["."],
    ["$"],
    ["0"],
    ["0.00"],
    ["-5"],
    ["-5.00"],
    ["12.345"],
    ["1.2.3"],
    ["abc"],
    ["12abc"],
    ["1e3"],
    ["Infinity"],
  ])("rejects %j", (input) => {
    expect(parseAmountToCents(input)).toBeNull();
  });

  it("accepts the largest amount the database can store", () => {
    expect(parseAmountToCents("21474836.47")).toBe(MAX_CENTS);
  });

  it("rejects amounts too large for the database", () => {
    expect(parseAmountToCents("21474836.48")).toBeNull();
    expect(parseAmountToCents("99999999999999999999")).toBeNull();
  });
});

describe("centsToDecimal", () => {
  it.each([
    [123456, "1234.56"],
    [5, "0.05"],
    [100, "1.00"],
    [0, "0.00"],
    [-2505, "-25.05"],
  ])("formats %i as %j", (cents, text) => {
    expect(centsToDecimal(cents)).toBe(text);
  });

  it("round-trips with parseAmountToCents", () => {
    for (const cents of [1, 99, 100, 4250, 123456, MAX_CENTS]) {
      expect(parseAmountToCents(centsToDecimal(cents))).toBe(cents);
    }
  });
});

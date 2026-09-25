import { describe, expect, it } from "vitest";
import { payeeMatches, payeeSearchNeedle } from "./search";

const payee = { full_name: "Alex Sample", email: "alex@example.com", payment_handle: "@alex-pays" };

describe("payeeMatches", () => {
  it("matches the name, email, or handle without regard to case", () => {
    expect(payeeMatches(payee, payeeSearchNeedle("  SAMPLE "))).toBe(true);
    expect(payeeMatches(payee, payeeSearchNeedle("example.com"))).toBe(true);
    expect(payeeMatches(payee, payeeSearchNeedle("@alex-p"))).toBe(true);
  });

  it("matches everything for an empty search", () => {
    expect(payeeMatches(payee, payeeSearchNeedle("   "))).toBe(true);
  });

  it("skips missing contact info", () => {
    const bare = { full_name: "Casey Placeholder", email: null, payment_handle: null };
    expect(payeeMatches(bare, "casey")).toBe(true);
    expect(payeeMatches(bare, "example")).toBe(false);
  });
});

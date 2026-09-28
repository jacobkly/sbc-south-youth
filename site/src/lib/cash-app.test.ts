import { describe, expect, it } from "vitest";
import { cashAppUrl } from "./cash-app";

describe("cashAppUrl", () => {
  it("links to the cashtag's Cash App page", () => {
    expect(cashAppUrl("$ExampleYouth")).toBe("https://cash.app/$ExampleYouth");
    expect(cashAppUrl("$Example_Youth_2")).toBe("https://cash.app/$Example_Youth_2");
  });

  it("refuses anything that isn't a cashtag, so a bad value can't become a link", () => {
    for (const value of ["", "$", "ExampleYouth", "$Example Youth", "$../give", "$Example/Youth", "https://example.org"]) {
      expect(() => cashAppUrl(value)).toThrow(/cashtag/);
    }
  });
});

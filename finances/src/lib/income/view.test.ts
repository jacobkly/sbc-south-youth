import { describe, expect, it } from "vitest";
import { incomeHref, parseIncomeTab } from "./view";

describe("parseIncomeTab", () => {
  it("opens on Youth", () => {
    expect(parseIncomeTab({})).toBe("youth");
  });

  it("reads the tab from the URL", () => {
    expect(parseIncomeTab({ tab: "cafe" })).toBe("cafe");
    expect(parseIncomeTab({ tab: ["cafe", "youth"] })).toBe("cafe");
  });

  it("falls back to Youth for anything else", () => {
    expect(parseIncomeTab({ tab: "expenses" })).toBe("youth");
  });
});

describe("incomeHref", () => {
  it("leaves the default tab out of the URL", () => {
    expect(incomeHref("youth")).toBe("/admin/income");
    expect(incomeHref("cafe")).toBe("/admin/income?tab=cafe");
  });
});

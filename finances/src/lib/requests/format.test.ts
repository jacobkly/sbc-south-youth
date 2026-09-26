import { describe, expect, it } from "vitest";
import { formatRequestNumber, isEditable, requestTitle } from "./format";

describe("requestTitle", () => {
  it("uses the vendor first", () => {
    expect(requestTitle({ vendor: "Test Market", description: "Snacks", type: "youth" })).toBe("Test Market");
  });

  it("falls back to the description, then the type", () => {
    expect(requestTitle({ vendor: null, description: "Snacks", type: "youth" })).toBe("Snacks");
    expect(requestTitle({ vendor: null, description: null, type: "cafe" })).toBe("Cafe purchase");
  });
});

describe("formatRequestNumber", () => {
  it("pads to four digits", () => {
    expect(formatRequestNumber(1)).toBe("R-0001");
    expect(formatRequestNumber(42)).toBe("R-0042");
  });

  it("keeps longer numbers whole", () => {
    expect(formatRequestNumber(12345)).toBe("R-12345");
  });
});

describe("isEditable", () => {
  it("allows edits until a request is approved or closed", () => {
    expect(isEditable("draft")).toBe(true);
    expect(isEditable("submitted")).toBe(true);
    expect(isEditable("needs_info")).toBe(true);
    expect(isEditable("approved")).toBe(false);
    expect(isEditable("paid")).toBe(false);
    expect(isEditable("rejected")).toBe(false);
    expect(isEditable("cancelled")).toBe(false);
  });
});

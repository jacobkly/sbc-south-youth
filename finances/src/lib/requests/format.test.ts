import { describe, expect, it } from "vitest";
import { formatRequestNumber, isCorrectable, isEditable, isEditableByRequester, listedDate, requestTitle } from "./format";

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

describe("isCorrectable", () => {
  it("lets an owner correct a request once it's approved or paid", () => {
    expect(isCorrectable("approved")).toBe(true);
    expect(isCorrectable("paid")).toBe(true);
  });

  it("leaves open requests to a plain edit, and closed ones alone", () => {
    for (const status of ["draft", "submitted", "needs_info", "rejected", "cancelled"] as const) {
      expect(isCorrectable(status)).toBe(false);
    }
  });
});

describe("isEditableByRequester", () => {
  it("lets a requester change a draft or answer a question", () => {
    expect(isEditableByRequester("draft")).toBe(true);
    expect(isEditableByRequester("needs_info")).toBe(true);
  });

  it("locks a request once it's waiting on review or decided", () => {
    for (const status of ["submitted", "approved", "paid", "rejected", "cancelled"] as const) {
      expect(isEditableByRequester(status)).toBe(false);
    }
  });
});

describe("listedDate", () => {
  it("shows the day it was paid, in Los Angeles", () => {
    expect(listedDate({ paid_at: "2026-09-29T02:00:00Z", sort_at: "2026-09-29T02:00:00Z" })).toEqual({
      label: "Paid",
      date: "2026-09-28",
    });
  });

  it("shows the day it was created while it's unpaid", () => {
    expect(listedDate({ paid_at: null, sort_at: "2026-09-01T18:00:00Z" })).toEqual({
      label: "Created",
      date: "2026-09-01",
    });
  });
});

import { describe, expect, it } from "vitest";
import { recentEventNames } from "./event-names";

describe("recentEventNames", () => {
  it("keeps the newest spelling of each name and skips blanks", () => {
    const rows = [
      { event_name: "Test Retreat" },
      { event_name: null },
      { event_name: "  " },
      { event_name: "test  retreat" },
      { event_name: " Test Camp " },
    ];
    expect(recentEventNames(rows)).toEqual(["Test Retreat", "Test Camp"]);
  });

  it("stops at the limit", () => {
    const rows = ["A", "B", "C"].map((event_name) => ({ event_name }));
    expect(recentEventNames(rows, 2)).toEqual(["A", "B"]);
  });
});

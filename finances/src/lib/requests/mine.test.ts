import { describe, expect, it } from "vitest";
import { groupMyRequests } from "./mine";

describe("groupMyRequests", () => {
  it("puts drafts and requests that need info under To finish", () => {
    const rows = [
      { id: "a", status: "draft" as const },
      { id: "b", status: "submitted" as const },
      { id: "c", status: "needs_info" as const },
      { id: "d", status: "paid" as const },
    ];

    const { toFinish, sent } = groupMyRequests(rows);

    expect(toFinish.map((row) => row.id)).toEqual(["c", "a"]);
    expect(sent.map((row) => row.id)).toEqual(["b", "d"]);
  });

  it("lists the ones that need info first, keeping the order otherwise", () => {
    const rows = [
      { id: "draft-new", status: "draft" as const },
      { id: "info-new", status: "needs_info" as const },
      { id: "draft-old", status: "draft" as const },
      { id: "info-old", status: "needs_info" as const },
    ];

    expect(groupMyRequests(rows).toFinish.map((row) => row.id)).toEqual([
      "info-new",
      "info-old",
      "draft-new",
      "draft-old",
    ]);
  });

  it("returns empty groups for no requests", () => {
    expect(groupMyRequests([])).toEqual({ toFinish: [], sent: [] });
  });
});

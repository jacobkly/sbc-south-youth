import { describe, expect, it } from "vitest";
import { removesFromText, tagStats } from "./totals";

const RETREAT = "60f8c566-5d7b-4170-af8c-0384aabdae30";
const VAN = "77615982-ee6d-4f48-99b4-332e8489f45b";

describe("tagStats", () => {
  it("counts every request with the tag and sums the approved and paid ones", () => {
    const stats = tagStats([
      { tag_id: RETREAT, request: { status: "paid", amount_cents: 6410 } },
      { tag_id: RETREAT, request: { status: "approved", amount_cents: 1000 } },
      { tag_id: RETREAT, request: { status: "needs_info", amount_cents: 12000 } },
      { tag_id: VAN, request: { status: "submitted", amount_cents: 2500 } },
    ]);
    expect(stats).toEqual({
      [RETREAT]: { count: 3, totalCents: 7410 },
      [VAN]: { count: 1, totalCents: 0 },
    });
  });

  it("counts drafts, rejected, and cancelled requests without adding them to the total", () => {
    const stats = tagStats([
      { tag_id: VAN, request: { status: "draft", amount_cents: 100 } },
      { tag_id: VAN, request: { status: "rejected", amount_cents: 200 } },
      { tag_id: VAN, request: { status: "cancelled", amount_cents: 300 } },
    ]);
    expect(stats[VAN]).toEqual({ count: 3, totalCents: 0 });
  });

  it("skips a link whose request can't be read", () => {
    expect(tagStats([{ tag_id: VAN, request: null }])).toEqual({});
  });

  it("leaves out tags on no requests", () => {
    expect(tagStats([])).toEqual({});
  });
});

describe("removesFromText", () => {
  it("says how many requests lose the tag", () => {
    expect(removesFromText(12)).toBe("Removes it from 12 requests.");
    expect(removesFromText(1)).toBe("Removes it from 1 request.");
    expect(removesFromText(1200)).toBe("Removes it from 1,200 requests.");
  });

  it("says when no request has it", () => {
    expect(removesFromText(0)).toBe("It isn't on any requests.");
  });
});

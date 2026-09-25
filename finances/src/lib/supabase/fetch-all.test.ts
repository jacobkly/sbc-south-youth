import { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { fetchAll } from "./fetch-all";

/** A fake query over `total` rows that returns at most `cap` per request. */
function fakeQuery(total: number, cap: number) {
  const rows = Array.from({ length: total }, (_, index) => ({ n: index }));
  return vi.fn(async (from: number, to: number) => ({
    data: rows.slice(from, Math.min(to + 1, from + cap)),
    error: null,
  }));
}

describe("fetchAll", () => {
  it("loads every page until one comes back empty", async () => {
    const page = fakeQuery(2500, 1000);
    const rows = await fetchAll(page);
    expect(rows).toHaveLength(2500);
    expect(rows.at(-1)).toEqual({ n: 2499 });
    expect(page.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
      [2500, 3499],
    ]);
  });

  it("still loads everything when the project caps rows lower", async () => {
    const page = fakeQuery(1200, 500);
    const rows = await fetchAll(page);
    expect(rows.map((row) => row.n)).toEqual(Array.from({ length: 1200 }, (_, index) => index));
  });

  it("returns nothing for an empty query", async () => {
    expect(await fetchAll(fakeQuery(0, 1000))).toEqual([]);
  });

  it("throws the query's error", async () => {
    const error = new PostgrestError({ code: "42501", message: "permission denied", details: "", hint: "" });
    await expect(fetchAll(async () => ({ data: null, error }))).rejects.toBe(error);
  });
});

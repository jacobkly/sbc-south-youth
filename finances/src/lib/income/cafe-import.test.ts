import { describe, expect, it } from "vitest";
import { NO_LINES, type CafeLines, type CafeWeek } from "./cafe";
import { byImportOrder, cafeImportWrites, planCafeImport, type CafeImportFile } from "./cafe-import";

const TODAY = "2026-10-21";

const LINES: CafeLines = { ...NO_LINES, sales_cents: 61250, discounts_cents: 9825, tips_cents: 4110, fees_cents: 1645 };

function file(name: string, week_ending: string | null, picked: string | null = null): CafeImportFile {
  return { key: `k-${name}`, name, parsed: { ok: true, week_ending, lines: LINES }, picked };
}

function saved(week_ending: string, id = `id-${week_ending}`): Pick<CafeWeek, "id" | "week_ending"> {
  return { id, week_ending };
}

describe("planCafeImport", () => {
  it("adds a week that isn't in yet", () => {
    expect(planCafeImport([file("a.csv", "2026-10-11")], [], TODAY)).toEqual([
      { key: "k-a.csv", name: "a.csv", status: "new", week_ending: "2026-10-11", lines: LINES },
    ]);
  });

  it("marks a week that's already in, with its id", () => {
    expect(planCafeImport([file("a.csv", "2026-10-11")], [saved("2026-10-11", "w1")], TODAY)).toEqual([
      { key: "k-a.csv", name: "a.csv", status: "existing", week_ending: "2026-10-11", lines: LINES, id: "w1" },
    ]);
  });

  it("passes on the reader's error", () => {
    const bad: CafeImportFile = { key: "k-b.csv", name: "b.csv", parsed: { ok: false, error: "Nope." }, picked: null };
    expect(planCafeImport([bad], [], TODAY)).toEqual([{ key: "k-b.csv", name: "b.csv", status: "error", error: "Nope." }]);
  });

  it("waits for a week to be picked when the name has no dates", () => {
    expect(planCafeImport([file("cafe.csv", null)], [], TODAY)).toEqual([
      { key: "k-cafe.csv", name: "cafe.csv", status: "needs_week", lines: LINES },
    ]);
    expect(planCafeImport([file("cafe.csv", null, "2026-10-04")], [], TODAY)[0]).toMatchObject({
      status: "new",
      week_ending: "2026-10-04",
    });
  });

  it("takes this week before it ends, but not a week that hasn't started", () => {
    expect(planCafeImport([file("a.csv", "2026-10-25")], [], TODAY)[0].status).toBe("new");
    expect(planCafeImport([file("a.csv", "2026-11-01")], [], TODAY)[0]).toEqual({
      key: "k-a.csv",
      name: "a.csv",
      status: "error",
      error: "This file's week hasn't started yet.",
    });
  });

  it("turns away a week before 2000", () => {
    expect(planCafeImport([file("a.csv", "1999-12-26")], [], TODAY)[0]).toMatchObject({
      status: "error",
      error: "Pick a week in 2000 or later.",
    });
  });

  it("turns away every file for a week that's in more than one", () => {
    const plan = planCafeImport(
      [file("a.csv", "2026-10-11"), file("b.csv", "2026-10-04"), file("c.csv", null, "2026-10-11")],
      [],
      TODAY,
    );
    expect(plan.map((row) => row.status)).toEqual(["error", "new", "error"]);
    expect(plan[0]).toMatchObject({ error: "Two files are for this week. Leave one of them out." });
  });
});

describe("cafeImportWrites", () => {
  const plan = planCafeImport(
    [file("a.csv", "2026-10-11"), file("b.csv", "2026-10-04"), file("c.csv", "2026-09-27"), file("d.csv", null)],
    [saved("2026-10-04", "w1"), saved("2026-09-27", "w2")],
    TODAY,
  );

  it("adds new weeks from Square, each with its file's key, and replaces only the weeks picked", () => {
    expect(cafeImportWrites(plan, new Set(["2026-09-27"]))).toEqual({
      inserts: [{ id: "k-a.csv", week_ending: "2026-10-11", ...LINES, source: "square" }],
      updates: [{ id: "w2", ...LINES, source: "square" }],
    });
  });

  it("leaves weeks already in alone unless they're picked", () => {
    expect(cafeImportWrites(plan, new Set()).updates).toEqual([]);
  });
});

describe("byImportOrder", () => {
  it("puts problems first, then files waiting for a week, then weeks newest first", () => {
    const bad: CafeImportFile = { key: "k-bad", name: "bad.csv", parsed: { ok: false, error: "Nope." }, picked: null };
    const files = [
      file("apr.csv", "2026-04-12"),
      file("dec.csv", "2025-12-28"),
      file("cafe.csv", null),
      file("oct.csv", "2026-10-18"),
      bad,
      file("sep.csv", "2026-09-27"),
    ];
    expect(files.sort(byImportOrder).map((entry) => entry.name)).toEqual([
      "bad.csv",
      "cafe.csv",
      "oct.csv",
      "sep.csv",
      "apr.csv",
      "dec.csv",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import type { ImportRow } from "./parse";
import { monthTotals, planImport, type ExistingPayee } from "./plan";

const ME = "user-me";

function row(line: number, name: string, date: string, cents: number, type: ImportRow["type"] = "youth"): ImportRow {
  return { line, date, name, amount_cents: cents, type, notes: "" };
}

function payee(id: string, full_name: string, extra: Partial<ExistingPayee> = {}): ExistingPayee {
  return { id, full_name, user_id: null, is_active: true, created_at: "2026-01-01T00:00:00Z", ...extra };
}

describe("planImport", () => {
  it("lists new payees once, in the order they appear, spelled as first seen", () => {
    const plan = planImport(
      [row(2, "Sam Sample", "2026-01-05", 100), row(3, "Alex Example", "2026-01-06", 100), row(4, "sam  sample", "2026-01-07", 100)],
      [payee("p1", "Pat Example")],
      [],
      ME,
    );
    expect(plan.newPayees).toEqual(["Sam Sample", "Alex Example"]);
  });

  it("names the payee each row is saved under", () => {
    const plan = planImport(
      [row(2, "pat EXAMPLE", "2026-01-05", 100), row(3, "Sam Sample", "2026-01-06", 100), row(4, "sam  SAMPLE", "2026-01-07", 100)],
      [payee("p1", "Pat Example")],
      [],
      ME,
    );
    expect([...plan.payeeNames]).toEqual([
      [2, "Pat Example"],
      [3, "Sam Sample"],
      [4, "Sam Sample"],
    ]);
  });

  it("matches existing payees ignoring case and spacing", () => {
    const plan = planImport([row(2, "pat EXAMPLE", "2026-01-05", 100)], [payee("p1", "Pat  Example")], [], ME);
    expect(plan.newPayees).toEqual([]);
  });

  it("flags rows already in the app, each request matching one row", () => {
    const plan = planImport(
      [
        row(2, "Pat Example", "2026-01-05", 1250),
        row(3, "Pat Example", "2026-01-05", 1250),
        row(4, "Pat Example", "2026-01-06", 1250),
      ],
      [payee("p1", "Pat Example")],
      [{ payee_id: "p1", purchase_date: "2026-01-05", amount_cents: 1250 }],
      ME,
    );
    expect([...plan.duplicates]).toEqual([2]);
  });

  it("never flags rows for new payees as duplicates", () => {
    const plan = planImport([row(2, "New Person", "2026-01-05", 1250)], [], [], ME);
    expect(plan.duplicates.size).toBe(0);
  });

  it("finds rows paid to the signed-in admin, preferring active payees like the import does", () => {
    const plan = planImport(
      [row(2, "Casey Test", "2026-01-05", 100), row(3, "Riley Demo", "2026-01-05", 100)],
      [
        payee("old", "Casey Test", { is_active: false, created_at: "2025-01-01T00:00:00Z" }),
        payee("mine", "Casey Test", { user_id: ME }),
        payee("other", "Riley Demo", { user_id: "someone-else" }),
      ],
      [],
      ME,
    );
    expect([...plan.selfRows]).toEqual([2]);
  });
});

describe("monthTotals", () => {
  it("adds up each month by type, oldest first", () => {
    expect(
      monthTotals([
        row(2, "A", "2026-02-10", 500, "cafe"),
        row(3, "B", "2026-01-05", 1000, "youth"),
        row(4, "C", "2026-02-11", 250, "youth"),
      ]),
    ).toEqual([
      { month: "2026-01", cafe: 0, youth: 1000, total: 1000, count: 1 },
      { month: "2026-02", cafe: 500, youth: 250, total: 750, count: 2 },
    ]);
  });
});

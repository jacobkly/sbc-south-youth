import { describe, expect, it } from "vitest";
import {
  currentIncome,
  incomeLine,
  incomeSubjects,
  titheImportLine,
  titheImportOf,
  titheImportTitle,
  weekLabel,
  type IncomeRow,
  type IncomeSubject,
} from "./income";

const TODAY = "2026-10-05";

const titheEntry = {
  kind: "tithe",
  received_on: "2026-10-04",
  amount_cents: 2500,
  method: "cash_app",
  event_name: null,
} as const;
const tithe: IncomeSubject = { type: "youth_income", entry: titheEntry, deleted: false };
const bakeSale: IncomeSubject = {
  type: "youth_income",
  entry: { kind: "event", received_on: "2026-10-04", amount_cents: 34000, method: null, event_name: "Bake sale" },
  deleted: false,
};
const cafeWeekFields = { week_ending: "2026-10-04", sales_cents: 65000, note: null };
const cafeWeek: IncomeSubject = { type: "cafe_week", week: cafeWeekFields, deleted: false };

function incomeRow(overrides: Partial<IncomeRow>): IncomeRow {
  return {
    action: "youth_income.created",
    entity_type: "youth_income",
    entity_id: "e1",
    changes: null,
    ...overrides,
  };
}

describe("incomeLine", () => {
  it("shows a tithe's amount, how it came in, and its date", () => {
    expect(incomeLine(tithe, TODAY)).toBe("$25.00 · Cash App · Oct 4");
  });

  it("leads with an event's name and calls money that came in more than one way Mixed", () => {
    expect(incomeLine(bakeSale, TODAY)).toBe("Bake sale · $340.00 · Mixed · Oct 4");
  });

  it("shows a cafe week's days and sales", () => {
    expect(incomeLine(cafeWeek, TODAY)).toBe("Sep 28 – Oct 4 · $650.00");
  });

  it("adds the year to a date from another year", () => {
    const lastYear: IncomeSubject = { ...tithe, entry: { ...titheEntry, received_on: "2025-12-28" } };
    expect(incomeLine(lastYear, TODAY)).toBe("$25.00 · Cash App · Dec 28, 2025");
    const newYear: IncomeSubject = { ...cafeWeek, week: { ...cafeWeekFields, week_ending: "2026-01-04" } };
    expect(incomeLine(newYear, "2026-10-05")).toBe("Dec 29, 2025 – Jan 4, 2026 · $650.00");
    const pastWeek: IncomeSubject = { ...cafeWeek, week: { ...cafeWeekFields, week_ending: "2025-09-21" } };
    expect(incomeLine(pastWeek, TODAY)).toBe("Sep 15–21, 2025 · $650.00");
  });

  it("always gives a week's year when there's no today to leave it out against", () => {
    expect(weekLabel("2026-09-27")).toBe("Sep 21–27, 2026");
    expect(weekLabel("2026-10-04", TODAY)).toBe("Sep 28 – Oct 4");
  });

  it("says when the entry can't be found", () => {
    expect(incomeLine(undefined, TODAY)).toBe("An entry that's gone");
  });
});

describe("tithe imports", () => {
  const importChanges = { count: 3, total_cents: 6000, method: "cash_app", first_on: "2026-01-07", last_on: "2026-02-04" };
  const titheImport = incomeRow({ action: "youth_income.imported", entity_id: null, changes: importChanges });

  it("reads how many tithes an import added, their total, how they came in, and the dates they cover", () => {
    expect(titheImportOf(titheImport)).toEqual({
      count: 3,
      totalCents: 6000,
      method: "cash_app",
      firstOn: "2026-01-07",
      lastOn: "2026-02-04",
    });
  });

  it("is null for any other row, or an import it can't read", () => {
    expect(titheImportOf(incomeRow({ changes: importChanges }))).toBeNull();
    expect(titheImportOf({ ...titheImport, changes: { ...importChanges, last_on: "someday" } })).toBeNull();
    expect(titheImportOf({ ...titheImport, changes: { ...importChanges, method: "venmo" } })).toBeNull();
  });

  it("counts the tithes, even when the row can't say how many", () => {
    expect(titheImportTitle(titheImportOf(titheImport))).toBe("Imported 3 tithes");
    expect(titheImportTitle(titheImportOf({ ...titheImport, changes: { ...importChanges, count: 1 } }))).toBe(
      "Imported 1 tithe",
    );
    expect(titheImportTitle(null)).toBe("Tithes imported");
  });

  it("shows the total, how they came in, and the dates with their year, like finances", () => {
    expect(titheImportLine(titheImportOf(titheImport)!)).toBe("$60.00 · Cash App · Jan 7 – Feb 4, 2026");
    const oneDay = titheImportOf({ ...titheImport, changes: { ...importChanges, last_on: "2026-01-07" } })!;
    expect(titheImportLine(oneDay)).toBe("$60.00 · Cash App · Jan 7, 2026");
    const newYear = titheImportOf({ ...titheImport, changes: { ...importChanges, first_on: "2025-12-28" } })!;
    expect(titheImportLine(newYear)).toBe("$60.00 · Cash App · Dec 28, 2025 – Feb 4, 2026");
  });
});

describe("incomeSubjects", () => {
  it("names each entry as it is now", () => {
    const rows = [incomeRow({ action: "youth_income.updated" })];
    expect(incomeSubjects(rows, new Map([["e1", tithe]])).get("e1")).toEqual(tithe);
  });

  it("names an entry since deleted as its delete recorded it", () => {
    const deleted = incomeRow({
      action: "youth_income.deleted",
      changes: {
        kind: { from: "event", to: null },
        received_on: { from: "2026-10-04", to: null },
        amount_cents: { from: 34000, to: null },
        method: { from: null, to: null },
        event_name: { from: "Bake sale", to: null },
      },
    });
    const created = incomeRow({
      changes: {
        kind: { from: null, to: "event" },
        received_on: { from: null, to: "2026-10-04" },
        amount_cents: { from: null, to: 30000 },
        method: { from: null, to: "cash" },
        event_name: { from: null, to: "Bake sale" },
      },
    });
    expect(incomeSubjects([deleted, created], new Map()).get("e1")).toEqual({ ...bakeSale, deleted: true });
  });

  it("names a deleted cafe week the same way", () => {
    const deleted = incomeRow({
      action: "cafe_week.deleted",
      entity_type: "cafe_week",
      changes: {
        week_ending: { from: "2026-10-04", to: null },
        sales_cents: { from: 65000, to: null },
        note: { from: null, to: null },
      },
    });
    expect(incomeSubjects([deleted], new Map()).get("e1")).toEqual({ ...cafeWeek, deleted: true });
  });

  it("leaves out entries it can't name, and rows that aren't income", () => {
    const edit = incomeRow({ action: "youth_income.updated", changes: { amount_cents: { from: 1, to: 2 } } });
    const post = incomeRow({ action: "post.created", entity_type: "post", changes: { title: { from: null, to: "x" } } });
    expect(incomeSubjects([edit, post], new Map([["other", tithe]])).size).toBe(0);
  });
});

describe("currentIncome", () => {
  it("keys the entries still there by id", () => {
    const subjects = currentIncome([{ id: "t1", ...titheEntry }], [{ id: "w1", ...cafeWeekFields }]);
    expect(subjects.get("t1")).toEqual(tithe);
    expect(subjects.get("w1")).toEqual(cafeWeek);
  });
});

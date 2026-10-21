import { describe, expect, it } from "vitest";
import { NO_LINES } from "@/lib/income/cafe";
import {
  currentSubjects,
  describeIncomeChanges,
  incomeLine,
  incomeSubjects,
  incomeTitle,
  mergeIncome,
  takeNewest,
  titheImportLine,
  titheImportOf,
  type IncomeChange,
  type IncomeSubject,
} from "./income";

const TODAY = "2026-10-05";

const titheEntry = { kind: "tithe", received_on: "2026-10-04", amount_cents: 2500, method: "cash_app", event_name: null } as const;
const tithe: IncomeSubject = { type: "youth_income", entry: titheEntry, deleted: false };
const bakeSale: IncomeSubject = {
  type: "youth_income",
  entry: { kind: "event", received_on: "2026-10-04", amount_cents: 34000, method: null, event_name: "Bake sale" },
  deleted: false,
};
const cafeWeekFields = {
  week_ending: "2026-10-04",
  ...NO_LINES,
  sales_cents: 65000,
  discounts_cents: 4500,
  fees_cents: 1500,
  source: "square",
  note: null,
};
const cafeWeek: IncomeSubject = { type: "cafe_week", week: cafeWeekFields, deleted: false };
const paybackFields = {
  kind: "discounts" as const,
  quarter_start: "2026-07-01",
  received_on: "2026-10-02",
  amount_cents: 12000,
  note: null,
};
const payback: IncomeSubject = { type: "cafe_payback", payback: paybackFields, deleted: false };

function change(overrides: Partial<IncomeChange>): IncomeChange {
  return {
    id: "c1",
    action: "youth_income.created",
    entity_type: "youth_income",
    entity_id: "e1",
    changes: null,
    created_at: "2026-10-05T18:00:00Z",
    ...overrides,
  };
}

const importChanges = {
  count: 3,
  total_cents: 6000,
  method: "cash_app",
  first_on: "2026-01-07",
  last_on: "2026-02-04",
};
const titheImport = change({ action: "youth_income.imported", entity_id: null, changes: importChanges });

describe("incomeTitle", () => {
  it("names a tithe, an event's income, and a cafe week, with what happened", () => {
    expect(incomeTitle(change({ action: "youth_income.created" }), tithe)).toBe("Tithe added");
    expect(incomeTitle(change({ action: "youth_income.updated" }), bakeSale)).toBe("Event income edited");
    expect(incomeTitle(change({ action: "cafe_week.deleted", entity_type: "cafe_week" }), cafeWeek)).toBe(
      "Cafe week deleted",
    );
  });

  it("names a church payback", () => {
    expect(incomeTitle(change({ action: "cafe_payback.created", entity_type: "cafe_payback" }), payback)).toBe(
      "Church payback added",
    );
  });

  it("falls back to youth income when it can't tell a tithe from an event", () => {
    expect(incomeTitle(change({ action: "youth_income.updated" }), undefined)).toBe("Youth income edited");
  });

  it("counts the tithes an import added", () => {
    expect(incomeTitle(titheImport, undefined)).toBe("Imported 3 tithes");
    expect(incomeTitle({ ...titheImport, changes: { ...importChanges, count: 1 } }, undefined)).toBe(
      "Imported 1 tithe",
    );
  });

  it("still names an import whose details it can't read", () => {
    expect(incomeTitle({ ...titheImport, changes: null }, undefined)).toBe("Tithes imported");
  });
});

describe("titheImportOf", () => {
  it("reads how many tithes an import added, their total, how they came in, and the dates they cover", () => {
    expect(titheImportOf(titheImport)).toEqual({
      count: 3,
      totalCents: 6000,
      method: "cash_app",
      firstOn: "2026-01-07",
      lastOn: "2026-02-04",
    });
  });

  it("is null for any other change, or an import it can't read", () => {
    expect(titheImportOf(change({ action: "youth_income.created" }))).toBeNull();
    expect(titheImportOf({ ...titheImport, changes: { ...importChanges, first_on: "someday" } })).toBeNull();
    expect(titheImportOf({ ...titheImport, changes: { ...importChanges, method: "venmo" } })).toBeNull();
  });
});

describe("titheImportLine", () => {
  it("shows the total, how they came in, and the dates they cover", () => {
    expect(titheImportLine(titheImportOf(titheImport)!)).toBe("$60.00 · Cash App · Jan 7 – Feb 4, 2026");
  });

  it("shows one date when every tithe is from the same day", () => {
    const oneDay = titheImportOf({ ...titheImport, changes: { ...importChanges, last_on: "2026-01-07" } })!;
    expect(titheImportLine(oneDay)).toBe("$60.00 · Cash App · Jan 7, 2026");
  });
});

describe("incomeLine", () => {
  it("shows a tithe's amount, how it came in, and its date", () => {
    expect(incomeLine(tithe, TODAY)).toBe("$25.00 · Cash App · Oct 4");
  });

  it("leads with an event's name and calls money that came in more than one way Mixed", () => {
    expect(incomeLine(bakeSale, TODAY)).toBe("Bake sale · $340.00 · Mixed · Oct 4");
  });

  it("leaves out an event's name when it has none", () => {
    const unnamed: IncomeSubject = { ...bakeSale, entry: { ...bakeSale.entry, event_name: null, method: "cash" } };
    expect(incomeLine(unnamed, TODAY)).toBe("$340.00 · Cash · Oct 4");
  });

  it("shows a cafe week's days and the money from Square", () => {
    expect(incomeLine(cafeWeek, TODAY)).toBe("Sep 28 – Oct 4 · $590.00");
  });

  it("shows the quarter a church payback covers, its amount, and when it came in", () => {
    expect(incomeLine(payback, TODAY)).toBe("Q3 2026 discounts · $120.00 · Oct 2");
  });

  it("says when a church payback was for gift cards", () => {
    const giftCards: IncomeSubject = {
      type: "cafe_payback",
      payback: { ...paybackFields, kind: "gift_cards", amount_cents: 25000 },
      deleted: false,
    };
    expect(incomeLine(giftCards, TODAY)).toBe("Q3 2026 gift cards · $250.00 · Oct 2");
  });

  it("says when nothing is known about the entry", () => {
    expect(incomeLine(undefined, TODAY)).toBe("Since deleted");
  });
});

describe("describeIncomeChanges", () => {
  it("lists each field an edit changed, in the form's order and words", () => {
    const edit = change({
      action: "youth_income.updated",
      changes: {
        method: { from: "cash_app", to: null },
        kind: { from: "tithe", to: "event" },
        amount_cents: { from: 2500, to: 4000 },
        event_name: { from: null, to: "Car wash" },
        received_on: { from: "2026-10-04", to: "2026-10-03" },
      },
    });
    expect(describeIncomeChanges(edit, TODAY)).toEqual([
      { field: "amount_cents", label: "Amount", from: "$25.00", to: "$40.00" },
      { field: "received_on", label: "Date given", from: "Oct 4, 2026", to: "Oct 3, 2026" },
      { field: "kind", label: "What it was", from: "Tithe", to: "Event" },
      { field: "event_name", label: "Event name", from: "None", to: "Car wash" },
      { field: "method", label: "How it came in", from: "Cash App", to: "Mixed" },
    ]);
  });

  it("describes a cafe week's sales and note", () => {
    const edit = change({
      action: "cafe_week.updated",
      entity_type: "cafe_week",
      changes: { sales_cents: { from: 61250, to: 65000 }, note: { from: null, to: "Fall kickoff night" } },
    });
    expect(describeIncomeChanges(edit, TODAY)).toEqual([
      { field: "sales_cents", label: "Gross sales", from: "$612.50", to: "$650.00" },
      { field: "note", label: "Note", from: "None", to: "Fall kickoff night" },
    ]);
  });

  it("describes each of a cafe week's Square lines, and where its numbers came from", () => {
    const edit = change({
      action: "cafe_week.updated",
      entity_type: "cafe_week",
      changes: {
        source: { from: "manual", to: "square" },
        taxes_cents: { from: 0, to: 120 },
        discounts_cents: { from: 0, to: 4500 },
        gift_card_redeemed_cents: { from: 0, to: 2500 },
      },
    });
    expect(describeIncomeChanges(edit, TODAY)).toEqual([
      { field: "discounts_cents", label: "Discounts & comps", from: "$0.00", to: "$45.00" },
      { field: "gift_card_redeemed_cents", label: "Gift card redeemed", from: "$0.00", to: "$25.00" },
      { field: "taxes_cents", label: "Taxes", from: "$0.00", to: "$1.20" },
      { field: "source", label: "Entered", from: "By hand", to: "From Square" },
    ]);
  });

  it("describes a church payback's kind, quarter, date, amount, and note", () => {
    const edit = change({
      action: "cafe_payback.updated",
      entity_type: "cafe_payback",
      changes: {
        kind: { from: "discounts", to: "gift_cards" },
        note: { from: null, to: "Short by one week" },
        amount_cents: { from: 12000, to: 9000 },
        quarter_start: { from: "2026-04-01", to: "2026-07-01" },
        received_on: { from: "2026-10-02", to: "2026-10-01" },
      },
    });
    expect(describeIncomeChanges(edit, TODAY)).toEqual([
      { field: "kind", label: "For", from: "Discounts", to: "Gift cards" },
      { field: "quarter_start", label: "Quarter", from: "Q2 2026", to: "Q3 2026" },
      { field: "received_on", label: "Date received", from: "Oct 2, 2026", to: "Oct 1, 2026" },
      { field: "amount_cents", label: "Amount", from: "$120.00", to: "$90.00" },
      { field: "note", label: "Note", from: "None", to: "Short by one week" },
    ]);
  });

  it("has nothing for adds and deletes, whose line already shows the entry", () => {
    const added = change({ changes: { amount_cents: { from: null, to: 2500 } } });
    const deleted = change({ action: "youth_income.deleted", changes: { amount_cents: { from: 2500, to: null } } });
    expect(describeIncomeChanges(added, TODAY)).toEqual([]);
    expect(describeIncomeChanges(deleted, TODAY)).toEqual([]);
  });
});

describe("incomeSubjects", () => {
  const snapshot = {
    kind: { from: "tithe", to: null },
    received_on: { from: "2026-10-04", to: null },
    amount_cents: { from: 4000, to: null },
    method: { from: "zelle", to: null },
    event_name: { from: null, to: null },
  };

  it("uses the entry as it is now when it's still there", () => {
    const changes = [change({ entity_id: "e1" })];
    const subjects = incomeSubjects(changes, new Map([["e1", tithe]]));
    expect(subjects.get("e1")).toEqual(tithe);
  });

  it("uses a deleted entry as it was when deleted, for every change to it", () => {
    const changes = [
      change({ id: "c3", entity_id: "e1", action: "youth_income.deleted", changes: snapshot }),
      change({ id: "c2", entity_id: "e1", action: "youth_income.updated", changes: { amount_cents: { from: 2500, to: 4000 } } }),
      change({
        id: "c1",
        entity_id: "e1",
        changes: { kind: { from: null, to: "tithe" }, received_on: { from: null, to: "2026-10-04" }, amount_cents: { from: null, to: 2500 }, method: { from: null, to: "cash_app" }, event_name: { from: null, to: null } },
      }),
    ];
    expect(incomeSubjects(changes, new Map()).get("e1")).toEqual({
      type: "youth_income",
      entry: { kind: "tithe", received_on: "2026-10-04", amount_cents: 4000, method: "zelle", event_name: null },
      deleted: true,
    });
  });

  it("rebuilds a deleted cafe week", () => {
    const changes = [
      change({
        entity_type: "cafe_week",
        action: "cafe_week.deleted",
        entity_id: "w1",
        changes: { week_ending: { from: "2026-08-16", to: null }, sales_cents: { from: 30000, to: null }, note: { from: null, to: null } },
      }),
    ];
    expect(incomeSubjects(changes, new Map()).get("w1")).toEqual({
      type: "cafe_week",
      week: { week_ending: "2026-08-16", ...NO_LINES, sales_cents: 30000, source: "manual", note: null },
      deleted: true,
    });
  });

  it("keeps a deleted cafe week's Square lines", () => {
    const changes = [
      change({
        entity_type: "cafe_week",
        action: "cafe_week.deleted",
        entity_id: "w1",
        changes: {
          week_ending: { from: "2026-10-04", to: null },
          sales_cents: { from: 65000, to: null },
          discounts_cents: { from: 4500, to: null },
          fees_cents: { from: 1500, to: null },
          source: { from: "square", to: null },
          note: { from: null, to: null },
        },
      }),
    ];
    expect(incomeSubjects(changes, new Map()).get("w1")).toEqual({ ...cafeWeek, deleted: true });
  });

  it("finds a deleted church payback from its delete", () => {
    const changes = [
      change({
        entity_type: "cafe_payback",
        action: "cafe_payback.deleted",
        entity_id: "p1",
        changes: {
          kind: { from: "discounts", to: null },
          quarter_start: { from: "2026-07-01", to: null },
          received_on: { from: "2026-10-02", to: null },
          amount_cents: { from: 12000, to: null },
          note: { from: null, to: null },
        },
      }),
    ];
    expect(incomeSubjects(changes, new Map()).get("p1")).toEqual({ ...payback, deleted: true });
  });

  it("leaves out an entry it knows nothing whole about", () => {
    const changes = [change({ action: "youth_income.updated", changes: { amount_cents: { from: 2500, to: 4000 } } })];
    expect(incomeSubjects(changes, new Map()).has("e1")).toBe(false);
  });
});

describe("currentSubjects", () => {
  it("keys youth entries, cafe weeks, and church paybacks by id", () => {
    const subjects = currentSubjects(
      [{ id: "e1", ...titheEntry }],
      [{ id: "w1", ...cafeWeekFields }],
      [{ id: "p1", ...paybackFields }],
    );
    expect(subjects.get("e1")).toEqual(tithe);
    expect(subjects.get("w1")).toEqual(cafeWeek);
    expect(subjects.get("p1")).toEqual(payback);
  });
});

describe("takeNewest", () => {
  const at = (id: string, created_at: string) => ({ id, created_at });

  it("keeps the newest of both lists, in order", () => {
    const requests = [at("r2", "2026-10-05T18:03:00Z"), at("r1", "2026-10-05T18:00:00Z")];
    const income = [at("i2", "2026-10-05T18:04:00Z"), at("i1", "2026-10-05T18:01:00Z")];
    expect(takeNewest(requests, income, 3)).toEqual({
      a: [at("r2", "2026-10-05T18:03:00Z")],
      b: [at("i2", "2026-10-05T18:04:00Z"), at("i1", "2026-10-05T18:01:00Z")],
      more: true,
    });
  });

  it("says there's no more when both lists fit", () => {
    expect(takeNewest([at("r1", "2026-10-05T18:00:00Z")], [], 50)).toEqual({
      a: [at("r1", "2026-10-05T18:00:00Z")],
      b: [],
      more: false,
    });
  });

  it("breaks a tie the way the database orders, by the higher id", () => {
    const { a, b } = takeNewest([at("a", "2026-10-05T18:00:00Z")], [at("b", "2026-10-05T18:00:00Z")], 1);
    expect(a).toEqual([]);
    expect(b).toEqual([at("b", "2026-10-05T18:00:00Z")]);
  });
});

describe("mergeIncome", () => {
  it("puts each income change between the request items by when it happened, once each", () => {
    const requests = [
      { type: "request" as const, key: "r2", created_at: "2026-10-05T18:03:00Z" },
      { type: "request" as const, key: "r1", created_at: "2026-10-05T18:00:00Z" },
    ];
    const income = [
      change({ id: "i2", created_at: "2026-10-05T18:04:00Z" }),
      change({ id: "i1", created_at: "2026-10-05T18:01:00Z" }),
    ];
    expect(mergeIncome(requests, income).map((item) => item.key)).toEqual(["i2", "r2", "i1", "r1"]);
    expect(mergeIncome(requests, income)[0]).toEqual({
      type: "income",
      key: "i2",
      created_at: "2026-10-05T18:04:00Z",
      change: income[0],
    });
  });
});

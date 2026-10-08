import { describe, expect, it } from "vitest";
import { matchingTithes, parseTitheImport, titheMonthTotals, type TitheRow } from "./import";

const TODAY = "2026-10-05";

describe("parseTitheImport", () => {
  it("reads Date then Amount when there's no header row", () => {
    expect(parseTitheImport("1/4/2026\t25\n1/11/2026\t$40.00\n", TODAY)).toEqual({
      ok: true,
      rows: [
        { line: 1, date: "2026-01-04", amount_cents: 2500 },
        { line: 2, date: "2026-01-11", amount_cents: 4000 },
      ],
      problems: [],
      hasHeader: false,
    });
  });

  it("finds the columns by their header in any order and ignores the rest", () => {
    const parsed = parseTitheImport('Amount,Note,Date\n"$1,234.50",ignored,2026-02-01\n', TODAY);
    expect(parsed).toEqual({
      ok: true,
      rows: [{ line: 2, date: "2026-02-01", amount_cents: 123450 }],
      problems: [],
      hasHeader: true,
    });
  });

  it("takes Tithe as the amount's header", () => {
    const parsed = parseTitheImport("Date,Tithe\n3/1/2026,15\n", TODAY);
    expect(parsed.ok && parsed.rows).toEqual([{ line: 2, date: "2026-03-01", amount_cents: 1500 }]);
  });

  it("says which column a header row is missing", () => {
    expect(parseTitheImport("Date,Who\n3/1/2026,15\n", TODAY)).toEqual({
      ok: false,
      error: "The header row is missing a column: Amount.",
    });
  });

  it("lists each row's problems by its row number", () => {
    const parsed = parseTitheImport(
      [
        "Date,Amount",
        "13/40/2026,25",
        "10/6/2026,25",
        "12/31/1999,25",
        "1/4/2026,0",
        "1/4/2026,-5",
        ",",
        "1/4/2026,1000000.01",
        "1/4/2026,",
        "1/11/2026,20",
      ].join("\n"),
      TODAY,
    );
    expect(parsed).toEqual({
      ok: true,
      rows: [{ line: 10, date: "2026-01-11", amount_cents: 2000 }],
      problems: [
        { line: 2, messages: ["The date “13/40/2026” isn't a date. Use a format like 1/15/2026."] },
        { line: 3, messages: ["The date can't be in the future."] },
        { line: 4, messages: ["The date can't be before 2000."] },
        { line: 5, messages: ["The amount “0” isn't a dollar amount above $0."] },
        { line: 6, messages: ["The amount “-5” isn't a dollar amount above $0."] },
        { line: 8, messages: ["The amount can't be more than $1,000,000.00."] },
        { line: 9, messages: ["The amount is blank."] },
      ],
      hasHeader: true,
    });
  });

  it("puts both of a row's problems together", () => {
    const parsed = parseTitheImport("someday\tlots\n", TODAY);
    expect(parsed.ok && parsed.problems).toEqual([
      {
        line: 1,
        messages: [
          "The date “someday” isn't a date. Use a format like 1/15/2026.",
          "The amount “lots” isn't a dollar amount above $0.",
        ],
      },
    ]);
  });

  it("skips blank rows and counts lines from the top", () => {
    const parsed = parseTitheImport("\n1/4/2026,25\n\n , \n1/11/2026,30", TODAY);
    expect(parsed.ok && parsed.rows.map((row) => row.line)).toEqual([2, 5]);
  });

  it("turns down a paste with no rows", () => {
    expect(parseTitheImport("Date,Amount\n\n", TODAY)).toEqual({ ok: false, error: "There are no rows to import." });
    expect(parseTitheImport("", TODAY)).toEqual({ ok: false, error: "There are no rows to import." });
  });

  it("turns down more than 2,000 rows", () => {
    const text = Array.from({ length: 2001 }, () => "1/4/2026,25").join("\n");
    expect(parseTitheImport(text, TODAY)).toEqual({
      ok: false,
      error: "That's 2,001 rows. Import at most 2,000 at a time.",
    });
  });
});

describe("matchingTithes", () => {
  const rows: TitheRow[] = [
    { line: 1, date: "2026-01-04", amount_cents: 2500 },
    { line: 2, date: "2026-01-04", amount_cents: 2500 },
    { line: 3, date: "2026-01-04", amount_cents: 3000 },
    { line: 4, date: "2026-01-11", amount_cents: 2500 },
  ];

  it("finds rows with a tithe already entered for the same date and amount", () => {
    expect(matchingTithes(rows, [{ received_on: "2026-01-11", amount_cents: 2500 }])).toEqual(new Set([4]));
  });

  it("matches each tithe already entered to one row, so equal gifts on one day still count", () => {
    expect(matchingTithes(rows, [{ received_on: "2026-01-04", amount_cents: 2500 }])).toEqual(new Set([1]));
    expect(
      matchingTithes(rows, [
        { received_on: "2026-01-04", amount_cents: 2500 },
        { received_on: "2026-01-04", amount_cents: 2500 },
      ]),
    ).toEqual(new Set([1, 2]));
  });

  it("finds nothing when no tithe matches", () => {
    expect(matchingTithes(rows, [{ received_on: "2026-01-05", amount_cents: 2500 }])).toEqual(new Set());
  });
});

describe("titheMonthTotals", () => {
  it("counts and totals each month, oldest first", () => {
    expect(
      titheMonthTotals([
        { line: 1, date: "2026-02-01", amount_cents: 1000 },
        { line: 2, date: "2026-01-04", amount_cents: 2500 },
        { line: 3, date: "2026-01-11", amount_cents: 500 },
      ]),
    ).toEqual([
      { month: "2026-01", count: 2, total: 3000 },
      { month: "2026-02", count: 1, total: 1000 },
    ]);
  });
});

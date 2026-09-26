import { describe, expect, it } from "vitest";
import { nameKey, normalizeName, parseImport, parseSheetDate, parseSheetType, parseTable } from "./parse";

const TODAY = "2026-09-25";

describe("parseTable", () => {
  it("splits cells copied from a spreadsheet on tabs", () => {
    expect(parseTable("Date\tName\n1/5/2026\tAlex Example\n")).toEqual([
      ["Date", "Name"],
      ["1/5/2026", "Alex Example"],
    ]);
  });

  it("splits a CSV on commas, with quoted commas, quotes, and line breaks", () => {
    expect(parseTable('a,"b, c","say ""hi""","two\r\nlines"\r\nd,e,f,g')).toEqual([
      ["a", "b, c", 'say "hi"', "two\r\nlines"],
      ["d", "e", "f", "g"],
    ]);
  });

  it("drops a byte order mark and keeps empty fields", () => {
    expect(parseTable("﻿a,,c\n")).toEqual([["a", "", "c"]]);
  });

  it("keeps a last line with no line break", () => {
    expect(parseTable("a,b\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("parseSheetDate", () => {
  it("reads US dates with two- or four-digit years", () => {
    expect(parseSheetDate("1/5/2026")).toBe("2026-01-05");
    expect(parseSheetDate("01/05/2026")).toBe("2026-01-05");
    expect(parseSheetDate("12/31/25")).toBe("2025-12-31");
    expect(parseSheetDate("3-7-2024")).toBe("2024-03-07");
  });

  it("reads ISO dates and month names", () => {
    expect(parseSheetDate("2026-01-05")).toBe("2026-01-05");
    expect(parseSheetDate("2026/1/5")).toBe("2026-01-05");
    expect(parseSheetDate("Jan 5, 2026")).toBe("2026-01-05");
    expect(parseSheetDate("September 30 2025")).toBe("2025-09-30");
    expect(parseSheetDate("Sept. 3, 2025")).toBe("2025-09-03");
  });

  it("ignores a time after the date", () => {
    expect(parseSheetDate("1/5/2026 0:00:00")).toBe("2026-01-05");
    expect(parseSheetDate("1/5/2026 12:30 PM")).toBe("2026-01-05");
  });

  it("rejects dates that don't exist and other text", () => {
    expect(parseSheetDate("2/30/2026")).toBeNull();
    expect(parseSheetDate("13/1/2026")).toBeNull();
    expect(parseSheetDate("Smarch 1, 2026")).toBeNull();
    expect(parseSheetDate("46027")).toBeNull();
    expect(parseSheetDate("")).toBeNull();
  });
});

describe("parseSheetType", () => {
  it("reads cafe and youth in any case, with or without the accent", () => {
    expect(parseSheetType("Cafe")).toBe("cafe");
    expect(parseSheetType(" café ")).toBe("cafe");
    expect(parseSheetType("YOUTH")).toBe("youth");
  });

  it("rejects anything else", () => {
    expect(parseSheetType("Snacks")).toBeNull();
    expect(parseSheetType("")).toBeNull();
  });
});

describe("normalizeName and nameKey", () => {
  it("trims and collapses spaces, including non-breaking ones", () => {
    expect(normalizeName("  Alex   Example ")).toBe("Alex Example");
  });

  it("ignores case for matching", () => {
    expect(nameKey(" alex  EXAMPLE")).toBe(nameKey("Alex Example"));
  });
});

describe("parseImport", () => {
  it("reads rows in Date, Name, Amount, Type, Notes order without a header", () => {
    const result = parseImport("1/5/2026\tAlex Example\t$12.50\tYouth\tPizza\n", TODAY);
    expect(result).toEqual({
      ok: true,
      hasHeader: false,
      problems: [],
      rows: [{ line: 1, date: "2026-01-05", name: "Alex Example", amount_cents: 1250, type: "youth", notes: "Pizza" }],
    });
  });

  it("finds columns by header in any order and ignores extra ones", () => {
    const csv = "Type,Amount,Extra,Name,Date\nCafe,\"1,200.00\",x,Sam Sample,2026-02-01\n";
    const result = parseImport(csv, TODAY);
    expect(result).toEqual({
      ok: true,
      hasHeader: true,
      problems: [],
      rows: [{ line: 2, date: "2026-02-01", name: "Sam Sample", amount_cents: 120000, type: "cafe", notes: "" }],
    });
  });

  it("skips blank rows but keeps spreadsheet row numbers", () => {
    const result = parseImport("Date\tName\tAmount\tType\tNotes\n\n\t\t\t\t\n1/5/2026\tPat Example\t5\tCafe\t\n", TODAY);
    expect(result.ok && result.rows.map((row) => row.line)).toEqual([4]);
  });

  it("reports everything wrong with a row", () => {
    const result = parseImport("Date,Name,Amount,Type\n2/30/2026,,-5,Snacks\n", TODAY);
    expect(result.ok && result.problems).toEqual([
      {
        line: 2,
        messages: [
          "The date “2/30/2026” isn't a date. Use a format like 1/15/2026.",
          "The name is blank.",
          "The amount “-5” isn't a dollar amount above $0.",
          "The type “Snacks” isn't Cafe or Youth.",
        ],
      },
    ]);
  });

  it("rejects future dates, dates before 2000, and huge amounts", () => {
    const result = parseImport("9/26/2026,A,1,Cafe\n12/31/1999,B,1,Cafe\n1/1/2026,C,1000001,Cafe\n", TODAY);
    expect(result.ok && result.problems.map((problem) => problem.messages)).toEqual([
      ["The date can't be in the future."],
      ["The date can't be before 2000."],
      ["The amount can't be over $1,000,000.00."],
    ]);
  });

  it("allows today's date", () => {
    const result = parseImport(`${TODAY},Alex Example,1,Youth\n`, TODAY);
    expect(result.ok && result.rows).toHaveLength(1);
  });

  it("says which header columns are missing", () => {
    expect(parseImport("Date,Name,Notes\n1/5/2026,A,x\n", TODAY)).toEqual({
      ok: false,
      error: "The header row is missing columns: Amount, Type.",
    });
  });

  it("needs at least one row", () => {
    expect(parseImport("", TODAY)).toEqual({ ok: false, error: "There are no rows to import." });
    expect(parseImport("Date,Name,Amount,Type,Notes\n", TODAY)).toEqual({
      ok: false,
      error: "There are no rows to import.",
    });
  });

  it("caps an import at 2,000 rows", () => {
    const text = "1/5/2026,A,1,Cafe\n".repeat(2001);
    expect(parseImport(text, TODAY)).toEqual({
      ok: false,
      error: "That's 2,001 rows. Import at most 2,000 at a time.",
    });
  });
});

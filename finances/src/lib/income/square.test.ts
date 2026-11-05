import { describe, expect, it } from "vitest";
import { parseSalesSummary, parseSquareMoney } from "./square";

/** A made-up Square sales summary with these label and value rows. */
function summary(rows: [string, string][], title = "Sales summary - Summary\nAll day (12:00 AM-11:59 PM PT)"): string {
  const lines = rows.map(([label, value]) => `${label},${value.includes(",") ? `"${value}"` : value}`);
  return [`"${title}",`, ...lines, ""].join("\n");
}

// A plain week: discounts, tips, and fees, with no returns or gift cards.
const PLAIN: [string, string][] = [
  ["Gross sales", "$612.50"],
  ["Items", "$612.50"],
  ["Service charges", "$0.00"],
  ["Returns", "$0.00"],
  ["Discounts & comps", "($98.25)"],
  ["Net sales", "$514.25"],
  ["Deferred sales", "$0.00"],
  ["Gift card sales", "$0.00"],
  ["Taxes", "$0.00"],
  ["Tips", "$41.10"],
  ["Total sales", "$555.35"],
  ["Total payments collected", "$555.35"],
  ["Card", "$470.00"],
  ["Cash", "$70.35"],
  ["Cash App", "$15.00"],
  ["Fees", "($16.45)"],
  ["Square payment processing fees", "($16.45)"],
  ["Square fees", "($16.45)"],
  ["Net total", "$538.90"],
  ["Product sales transactions", "88"],
  ["Discounts transactions", "21"],
  ["Tips transactions", "30"],
];

// A week with a return, a gift card sold, and one redeemed. Square's fee
// rows overlap, so only Fees counts.
const GIFT_CARDS: [string, string][] = [
  ["Gross sales", "$500.00"],
  ["Items", "$500.00"],
  ["Service charges", "$0.00"],
  ["Returns", "($12.00)"],
  ["Discounts & comps", "($80.00)"],
  ["Net sales", "$408.00"],
  ["Deferred sales", "$50.00"],
  ["Gift card sales", "$50.00"],
  ["Taxes", "$0.00"],
  ["Tips", "$30.00"],
  ["Total sales", "$488.00"],
  ["Total payments collected", "$488.00"],
  ["Card", "$400.00"],
  ["Cash", "$63.00"],
  ["Gift card redeemed", "$25.00"],
  ["Fees", "($18.50)"],
  ["Square payment processing fees", "($15.54)"],
  ["International transaction fees", "($0.04)"],
  ["Square fees", "($15.50)"],
  ["Gift card load fees", "($3.00)"],
  ["Net total", "$469.50"],
];

const WEEK_FILE = "sales-summary-2026-10-05-2026-10-11.csv";

// The PLAIN week in Square's Weekly view, whose weeks run Sunday to Saturday,
// so Monday to Sunday comes as two columns with most of the money on Sunday.
const SPLIT: [string, string, string][] = [
  ["Gross sales", "$12.50", "$600.00"],
  ["Items", "$12.50", "$600.00"],
  ["Returns", "$0.00", "$0.00"],
  ["Discounts & comps", "$0.00", "($98.25)"],
  ["Discounts", "$0.00", "($98.25)"],
  ["Net sales", "$12.50", "$501.75"],
  ["Deferred sales", "$0.00", "$0.00"],
  ["Gift card sales", "$0.00", "$0.00"],
  ["Taxes", "$0.00", "$0.00"],
  ["Tips", "$0.00", "$41.10"],
  ["Total sales", "$12.50", "$542.85"],
  ["Total payments collected", "$12.50", "$542.85"],
  ["Fees", "($0.50)", "($15.95)"],
  ["Net total", "$12.00", "$526.90"],
  ["Tips transactions", "0", "30"],
];

/** A made-up file in Square's Weekly or Daily view, with a column for each header. */
function columns(rows: string[][], headers: string): string {
  const title = "Sales summary - Weekly\nAll day (12:00 AM-11:59 PM PT)";
  return [`"${title}",${headers}`, ...rows.map((row) => row.join(",")), ""].join("\n");
}

const SPLIT_HEADERS = "10/5/2026 – 10/10/2026,10/11/2026";

function without(rows: [string, string][], label: string): [string, string][] {
  return rows.filter(([name]) => name !== label);
}

function replaced(rows: [string, string][], label: string, value: string): [string, string][] {
  return rows.map(([name, old]) => [name, name === label ? value : old]);
}

describe("parseSquareMoney", () => {
  it("reads dollars with a sign and commas", () => {
    expect(parseSquareMoney("$2,302.60")).toBe(230260);
    expect(parseSquareMoney("$0.00")).toBe(0);
  });

  it("reads parentheses and a minus as below zero", () => {
    expect(parseSquareMoney("($19.50)")).toBe(-1950);
    expect(parseSquareMoney("-$5.00")).toBe(-500);
  });

  it("returns null for anything that isn't money", () => {
    expect(parseSquareMoney("391")).toBeNull();
    expect(parseSquareMoney("")).toBeNull();
    expect(parseSquareMoney("$1.234")).toBeNull();
  });
});

describe("parseSalesSummary", () => {
  it("reads a plain week's lines and its Sunday from the file name", () => {
    expect(parseSalesSummary(summary(PLAIN), WEEK_FILE)).toEqual({
      ok: true,
      week_ending: "2026-10-11",
      lines: {
        sales_cents: 61250,
        returns_cents: 0,
        discounts_cents: 9825,
        gift_card_sales_cents: 0,
        gift_card_redeemed_cents: 0,
        taxes_cents: 0,
        tips_cents: 4110,
        fees_cents: 1645,
      },
    });
  });

  it("reads returns, gift cards, and only the Fees total", () => {
    const parsed = parseSalesSummary(summary(GIFT_CARDS), WEEK_FILE);
    expect(parsed).toMatchObject({
      ok: true,
      lines: {
        sales_cents: 50000,
        returns_cents: 1200,
        discounts_cents: 8000,
        gift_card_sales_cents: 5000,
        gift_card_redeemed_cents: 2500,
        tips_cents: 3000,
        fees_cents: 1850,
      },
    });
  });

  it("matches labels in any case and skips rows it doesn't know", () => {
    const rows: [string, string][] = [
      ...PLAIN.map(([label, value]): [string, string] => [label.toUpperCase(), value]),
      ["Venmo", "$0.00"],
    ];
    expect(parseSalesSummary(summary(rows), WEEK_FILE)).toMatchObject({ ok: true, lines: { sales_cents: 61250 } });
  });

  it("reads a file with no title or a title with no day", () => {
    expect(parseSalesSummary(summary(PLAIN, "Sales summary - Summary\n(12:00 AM-11:59 PM PT)"), WEEK_FILE)).toMatchObject({
      ok: true,
    });
  });

  it("finds the dates in a downloaded copy's name", () => {
    expect(parseSalesSummary(summary(PLAIN), "sales-summary-2026-10-05-2026-10-11 (1).csv")).toMatchObject({
      ok: true,
      week_ending: "2026-10-11",
    });
  });

  it("leaves the week for the person to pick when the name has no dates", () => {
    expect(parseSalesSummary(summary(PLAIN), "cafe week.csv")).toMatchObject({ ok: true, week_ending: null });
  });

  it("turns away a week that isn't Monday to Sunday", () => {
    expect(parseSalesSummary(summary(PLAIN), "sales-summary-2026-10-04-2026-10-10.csv")).toEqual({
      ok: false,
      error: "This file covers Oct 4, 2026 to Oct 10, 2026. Export one week from Square, Monday to Sunday.",
    });
  });

  it("turns away a month", () => {
    expect(parseSalesSummary(summary(PLAIN), "sales-summary-2026-09-01-2026-09-30.csv")).toMatchObject({
      ok: false,
      error: expect.stringContaining("Monday to Sunday"),
    });
  });

  it("turns away part of each day", () => {
    expect(
      parseSalesSummary(summary(PLAIN, "Sales summary - Summary\n(9:00 AM-1:00 PM PT)"), WEEK_FILE),
    ).toEqual({
      ok: false,
      error: "This file covers only 9:00 AM-1:00 PM each day. Export it from Square with All day picked.",
    });
  });

  it("says which row is missing", () => {
    expect(parseSalesSummary(summary(without(PLAIN, "Net total")), WEEK_FILE)).toEqual({
      ok: false,
      error: "This doesn't look like Square's sales summary. It has no Net total row.",
    });
  });

  it("treats lines Square leaves out as $0", () => {
    const rows = without(without(without(PLAIN, "Returns"), "Deferred sales"), "Gift card sales");
    expect(parseSalesSummary(summary(rows), WEEK_FILE)).toMatchObject({
      ok: true,
      lines: { returns_cents: 0, gift_card_sales_cents: 0 },
    });
  });

  it("turns away a file whose net sales don't add up", () => {
    expect(parseSalesSummary(summary(replaced(PLAIN, "Net sales", "$514.24")), WEEK_FILE)).toEqual({
      ok: false,
      error: "Square's lines don't add up to its Net sales. Export the file again, or type the week in by hand.",
    });
  });

  it("or whose total payments don't", () => {
    expect(parseSalesSummary(summary(replaced(PLAIN, "Total payments collected", "$555.36")), WEEK_FILE)).toMatchObject({
      ok: false,
      error: expect.stringContaining("Total payments collected"),
    });
  });

  it("or whose net total doesn't", () => {
    expect(parseSalesSummary(summary(replaced(PLAIN, "Net total", "$540.00")), WEEK_FILE)).toMatchObject({
      ok: false,
      error: expect.stringContaining("Net total"),
    });
  });

  it("turns away deferred sales that aren't gift cards", () => {
    const rows = replaced(
      replaced(replaced(replaced(GIFT_CARDS, "Gift card sales", "$40.00"), "Deferred sales", "$50.00"), "Net total", "$469.50"),
      "Total sales",
      "$488.00",
    );
    expect(parseSalesSummary(summary(rows), WEEK_FILE)).toEqual({
      ok: false,
      error: "This week has deferred sales that aren't gift cards. Type the week in by hand.",
    });
  });

  it("turns away a line below $0 that should be money in", () => {
    const rows = replaced(replaced(replaced(PLAIN, "Tips", "($1.00)"), "Total sales", "$513.25"), "Total payments collected", "$513.25");
    expect(parseSalesSummary(summary(replaced(rows, "Net total", "$496.80")), WEEK_FILE)).toEqual({
      ok: false,
      error: "Tips is below $0 this week. Type the week in by hand.",
    });
  });

  it("adds up every column of a week Square split into columns", () => {
    expect(parseSalesSummary(columns(SPLIT, SPLIT_HEADERS), WEEK_FILE)).toEqual(parseSalesSummary(summary(PLAIN), WEEK_FILE));
  });

  it("reads a week split into a column per day", () => {
    const days = ["10/5/2026", "10/6/2026", "10/7/2026", "10/8/2026", "10/9/2026", "10/10/2026", "10/11/2026"];
    const rows = SPLIT.map(([label, monday, sunday]) => [label, monday, ...days.slice(1, -1).map(() => "$0.00"), sunday]);
    expect(parseSalesSummary(columns(rows, days.join(",")), WEEK_FILE)).toEqual(parseSalesSummary(summary(PLAIN), WEEK_FILE));
  });

  it("finds the week in the columns when the name has no dates", () => {
    expect(parseSalesSummary(columns(SPLIT, SPLIT_HEADERS), "cafe week.csv")).toMatchObject({
      ok: true,
      week_ending: "2026-10-11",
    });
  });

  it("never adds in a column that isn't a date, which could be a total", () => {
    const rows = SPLIT.map((row) => [...row, row[2]]);
    expect(parseSalesSummary(columns(rows, `${SPLIT_HEADERS},Total`), WEEK_FILE)).toEqual({
      ok: false,
      error: "Square split this file into columns that don't cover the whole week. Export it again in the Summary view.",
    });
  });

  it("turns away columns with a day missing", () => {
    expect(parseSalesSummary(columns(SPLIT, "10/5/2026 – 10/9/2026,10/11/2026"), WEEK_FILE)).toMatchObject({
      ok: false,
      error: expect.stringContaining("whole week"),
    });
  });

  it("turns away columns for a different week than the name says", () => {
    expect(parseSalesSummary(columns(SPLIT, "9/28/2026 – 10/3/2026,10/4/2026"), WEEK_FILE)).toMatchObject({
      ok: false,
      error: expect.stringContaining("whole week"),
    });
  });

  it("treats a row as missing when one column has no amount", () => {
    const rows = SPLIT.map((row) => (row[0] === "Net total" ? [row[0], row[1], "Not available"] : row));
    expect(parseSalesSummary(columns(rows, SPLIT_HEADERS), WEEK_FILE)).toEqual({
      ok: false,
      error: "This doesn't look like Square's sales summary. It has no Net total row.",
    });
  });

  it("turns away a file that isn't a sales summary", () => {
    expect(parseSalesSummary("Date,Amount\n2026-10-05,12.00\n", WEEK_FILE)).toMatchObject({ ok: false });
    expect(parseSalesSummary("", WEEK_FILE)).toMatchObject({ ok: false });
  });
});

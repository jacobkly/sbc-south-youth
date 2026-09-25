import { describe, expect, it } from "vitest";
import { csvField, toCsv } from "./csv";

describe("csvField", () => {
  it("leaves plain text and numbers alone", () => {
    expect(csvField("Costco")).toBe("Costco");
    expect(csvField(12.5)).toBe("12.5");
    expect(csvField("12.34")).toBe("12.34");
  });

  it("writes blanks for missing values", () => {
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
    expect(csvField("")).toBe("");
  });

  it("quotes commas, quotes, and line breaks", () => {
    expect(csvField("Snacks, drinks")).toBe('"Snacks, drinks"');
    expect(csvField('The "big" order')).toBe('"The ""big"" order"');
    expect(csvField("Line one\nline two")).toBe('"Line one\nline two"');
    expect(csvField("Line one\r\nline two")).toBe('"Line one\r\nline two"');
  });

  it("keeps non-ASCII text as is", () => {
    expect(csvField("Zoë Muñoz")).toBe("Zoë Muñoz");
    expect(csvField("Café 🎉")).toBe("Café 🎉");
  });

  it("stops text from running as a formula", () => {
    expect(csvField("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(csvField("+1 555")).toBe("'+1 555");
    expect(csvField("-5")).toBe("'-5");
    expect(csvField("@handle")).toBe("'@handle");
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvField(-5)).toBe("-5");
  });
});

describe("toCsv", () => {
  it("starts with a byte order mark and ends every line with CRLF", () => {
    const csv = toCsv(["name", "amount"], [
      ["Zoë, Test", "12.34"],
      ["Sam", null],
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe('﻿name,amount\r\n"Zoë, Test",12.34\r\nSam,\r\n');
  });

  it("writes just the header when there are no rows", () => {
    expect(toCsv(["a", "b"], [])).toBe("﻿a,b\r\n");
  });

  it("encodes as UTF-8 with the byte order mark first", () => {
    const bytes = new TextEncoder().encode(toCsv(["name"], [["é"]]));
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect([...bytes.slice(-4, -2)]).toEqual([0xc3, 0xa9]);
  });
});

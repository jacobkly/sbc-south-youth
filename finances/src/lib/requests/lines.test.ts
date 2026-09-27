import { afterEach, describe, expect, it, vi } from "vitest";
import { blankLine, enteredTotal, linesTotal, newLineId } from "./lines";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("newLineId", () => {
  it("makes a new UUID each time", () => {
    const first = newLineId();
    expect(first).toMatch(UUID);
    expect(newLineId()).not.toBe(first);
  });

  it("still works where randomUUID doesn't exist, like a page on plain http", () => {
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });

    expect(newLineId()).toMatch(UUID);
  });
});

describe("blankLine", () => {
  it("starts empty with its own id", () => {
    const line = blankLine();
    expect(line).toEqual({ id: expect.stringMatching(UUID), amount: "", vendor: "" });
    expect(blankLine().id).not.toBe(line.id);
  });
});

describe("linesTotal", () => {
  it("adds up the amounts", () => {
    expect(linesTotal([{ amount_cents: 1000 }, { amount_cents: 1500 }, { amount_cents: 1100 }])).toBe(3600);
  });

  it("is zero with no lines", () => {
    expect(linesTotal([])).toBe(0);
  });
});

describe("enteredTotal", () => {
  const line = (amount: string) => ({ id: "x", amount, vendor: "" });

  it("adds up the amounts as typed", () => {
    expect(enteredTotal([line("10"), line("$15.50"), line(" 1,000.25 ")])).toBe(102575);
  });

  it("counts a blank or unfinished amount as nothing yet", () => {
    expect(enteredTotal([line("12.00"), line(""), line("abc"), line("0")])).toBe(1200);
  });
});

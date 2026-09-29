import { describe, expect, it } from "vitest";
import { ELAPSED_FIELD, HONEYPOT_FIELD, looksAutomated, MIN_FILL_MS } from "./guard";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

describe("looksAutomated", () => {
  it("passes a person who took their time", () => {
    expect(looksAutomated(form({ [HONEYPOT_FIELD]: "", [ELAPSED_FIELD]: String(MIN_FILL_MS) }))).toBe(false);
    expect(looksAutomated(form({ [ELAPSED_FIELD]: "45000" }))).toBe(false);
  });

  it("catches a filled-in honeypot", () => {
    expect(looksAutomated(form({ [HONEYPOT_FIELD]: "https://spam.example", [ELAPSED_FIELD]: "45000" }))).toBe(true);
  });

  it("catches a form sent too fast", () => {
    expect(looksAutomated(form({ [ELAPSED_FIELD]: String(MIN_FILL_MS - 1) }))).toBe(true);
  });

  it("catches a form sent without the page's script", () => {
    expect(looksAutomated(form({}))).toBe(true);
    expect(looksAutomated(form({ [ELAPSED_FIELD]: "" }))).toBe(true);
    expect(looksAutomated(form({ [ELAPSED_FIELD]: "soon" }))).toBe(true);
  });
});

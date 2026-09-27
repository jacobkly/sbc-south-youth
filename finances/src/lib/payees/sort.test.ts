import { describe, expect, it } from "vitest";
import { sortPayees } from "./sort";

const PAYEES = [
  { id: "p1", full_name: "Sam Sample", created_at: "2026-03-01T17:00:00+00:00" },
  { id: "p2", full_name: "alex Example", created_at: "2026-09-01T17:00:00+00:00" },
  { id: "p3", full_name: "Pat Example", created_at: "2026-05-01T17:00:00+00:00" },
  { id: "p4", full_name: "Jordan Placeholder", created_at: "2026-05-01T17:00:00+00:00" },
];

const PAID = { p1: 1500, p3: 4200, p4: 1500 };

function names(sorted: { full_name: string }[]): string[] {
  return sorted.map((payee) => payee.full_name);
}

describe("sortPayees", () => {
  it("sorts by name, ignoring case", () => {
    expect(names(sortPayees(PAYEES, "name", PAID))).toEqual([
      "alex Example",
      "Jordan Placeholder",
      "Pat Example",
      "Sam Sample",
    ]);
  });

  it("sorts by what was paid, most first, then by name", () => {
    expect(names(sortPayees(PAYEES, "paid", PAID))).toEqual([
      "Pat Example",
      "Jordan Placeholder",
      "Sam Sample",
      "alex Example",
    ]);
  });

  it("sorts by when they were added, newest first, then by name", () => {
    expect(names(sortPayees(PAYEES, "newest", PAID))).toEqual([
      "alex Example",
      "Jordan Placeholder",
      "Pat Example",
      "Sam Sample",
    ]);
  });

  it("leaves the list it was given alone", () => {
    const copy = [...PAYEES];
    sortPayees(PAYEES, "name", PAID);
    expect(PAYEES).toEqual(copy);
  });
});

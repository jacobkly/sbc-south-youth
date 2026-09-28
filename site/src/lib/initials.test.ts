import { describe, expect, it } from "vitest";
import { initials } from "./initials";

describe("initials", () => {
  it("takes the first letter of the first and last names", () => {
    expect(initials("Alex Example")).toBe("AE");
    expect(initials("Mary Jane Sample")).toBe("MS");
  });

  it("handles one name, extra spaces, and lowercase", () => {
    expect(initials("Jordan")).toBe("J");
    expect(initials("  jordan   sample ")).toBe("JS");
  });

  it("returns an empty string for a blank name", () => {
    expect(initials("   ")).toBe("");
  });
});

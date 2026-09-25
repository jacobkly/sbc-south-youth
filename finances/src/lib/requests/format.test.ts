import { describe, expect, it } from "vitest";
import { formatRequestNumber } from "./format";

describe("formatRequestNumber", () => {
  it("pads to four digits", () => {
    expect(formatRequestNumber(1)).toBe("R-0001");
    expect(formatRequestNumber(42)).toBe("R-0042");
  });

  it("keeps longer numbers whole", () => {
    expect(formatRequestNumber(12345)).toBe("R-12345");
  });
});

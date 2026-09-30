import { describe, expect, it } from "vitest";
import { photoSizes } from "./photo-sizes";

describe("photoSizes", () => {
  it("spans the frame from lg up and the whole window on phones", () => {
    expect(photoSizes({ lg: 1 })).toBe("(min-width: 64rem) 93vw, 100vw");
  });

  it("takes a share of the frame on tablets and up", () => {
    expect(photoSizes({ lg: 0.6, md: 1 / 2 })).toBe("(min-width: 64rem) 56vw, (min-width: 48rem) 47vw, 100vw");
  });

  it("says a share once when tablets and desktops match", () => {
    expect(photoSizes({ lg: 1 / 2, md: 1 / 2 })).toBe("(min-width: 48rem) 47vw, 100vw");
  });

  it("uses the phone share on tablets when there's no tablet share", () => {
    expect(photoSizes({ lg: 0.4, phone: 0.4 })).toBe("(min-width: 64rem) 38vw, 40vw");
  });

  it("rounds up, but not past a whole number", () => {
    expect(photoSizes({ lg: 1 / 3 })).toBe("(min-width: 64rem) 31vw, 100vw");
    expect(photoSizes({ lg: 3 / 4 })).toBe("(min-width: 64rem) 70vw, 100vw");
  });

  it("never assumes the old 1200 px page", () => {
    for (const share of [1, 3 / 4, 0.6, 1 / 2, 1 / 3]) {
      expect(photoSizes({ lg: share, md: share })).not.toMatch(/px/);
    }
  });
});

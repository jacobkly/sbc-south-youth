import { describe, expect, it } from "vitest";
import { ALT_MAX, checkAlt, checkNewPhoto } from "./schema";

describe("checkAlt", () => {
  it("trims the description", () => {
    expect(checkAlt("  Hands raised during worship \n")).toEqual({ ok: true, alt: "Hands raised during worship" });
  });

  it("needs a description", () => {
    expect(checkAlt("   ")).toEqual({ ok: false, error: "Describe what's in the photo." });
  });

  it("keeps it short", () => {
    expect(checkAlt("a".repeat(ALT_MAX)).ok).toBe(true);
    expect(checkAlt("a".repeat(ALT_MAX + 1))).toEqual({
      ok: false,
      error: `Keep it to ${ALT_MAX} characters or fewer.`,
    });
  });
});

describe("checkNewPhoto", () => {
  const photo = {
    id: "0d3f6a8e-2b1c-4e5f-9a7b-1c2d3e4f5a6b",
    alt: " A crowd under stage lights ",
    width: 1600,
    height: 900,
  };

  it("passes a new photo's row through, with its alt text trimmed", () => {
    expect(checkNewPhoto(photo)).toEqual({ ok: true, row: { ...photo, alt: "A crowd under stage lights" } });
  });

  it("says what's wrong with the alt text", () => {
    expect(checkNewPhoto({ ...photo, alt: "" })).toEqual({ ok: false, message: "Describe what's in the photo." });
  });

  it("refuses an id that isn't a random folder name", () => {
    for (const id of ["jo-at-the-retreat", "", "0D3F6A8E-2B1C-4E5F-9A7B-1C2D3E4F5A6B", 42]) {
      expect(checkNewPhoto({ ...photo, id } as never).ok).toBe(false);
    }
  });

  it("refuses sizes the database wouldn't take", () => {
    for (const size of [0, 4001, 1.5, Number.NaN, "1600"]) {
      expect(checkNewPhoto({ ...photo, width: size } as never).ok).toBe(false);
      expect(checkNewPhoto({ ...photo, height: size } as never).ok).toBe(false);
    }
  });

  it("refuses alt text that isn't text", () => {
    expect(checkNewPhoto({ ...photo, alt: null } as never)).toEqual({
      ok: false,
      message: "Describe what's in the photo.",
    });
  });
});

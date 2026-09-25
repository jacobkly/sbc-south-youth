import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/admin/requests?tab=paid")).toBe("/admin/requests?tab=paid");
    expect(safeNextPath("/account")).toBe("/account");
  });

  it("falls back when missing", () => {
    expect(safeNextPath(null)).toBe("/admin");
    expect(safeNextPath(undefined)).toBe("/admin");
    expect(safeNextPath("")).toBe("/admin");
  });

  it("rejects other sites", () => {
    expect(safeNextPath("https://example.com")).toBe("/admin");
    expect(safeNextPath("//example.com")).toBe("/admin");
    expect(safeNextPath("/\\example.com")).toBe("/admin");
    expect(safeNextPath("/\t/example.com")).toBe("/admin");
    expect(safeNextPath("/\n/example.com")).toBe("/admin");
    expect(safeNextPath("admin")).toBe("/admin");
    expect(safeNextPath("javascript:alert(1)")).toBe("/admin");
  });

  it("never loops back into sign-in", () => {
    expect(safeNextPath("/login")).toBe("/admin");
    expect(safeNextPath("/login?next=/admin")).toBe("/admin");
    expect(safeNextPath("/auth/callback")).toBe("/admin");
    expect(safeNextPath("/./login")).toBe("/admin");
  });
});

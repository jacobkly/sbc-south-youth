import { describe, expect, it } from "vitest";
import { isSignInPath, safeNextPath, withNext } from "./next-path";

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
    expect(safeNextPath("/forgot")).toBe("/admin");
    expect(safeNextPath("/setup?next=/admin")).toBe("/admin");
  });

  it("never goes back to the code step", () => {
    expect(safeNextPath("/mfa")).toBe("/admin");
    expect(safeNextPath("/mfa?next=/account")).toBe("/admin");
  });
});

describe("isSignInPath", () => {
  it.each(["/login", "/forgot", "/setup", "/auth/callback"])("is %s", (pathname) => {
    expect(isSignInPath(pathname)).toBe(true);
  });

  it.each(["/", "/admin", "/logins", "/forgotten", "/auth", "/account/setup"])("isn't %s", (pathname) => {
    expect(isSignInPath(pathname)).toBe(false);
  });
});

describe("withNext", () => {
  it("leaves the usual place out", () => {
    expect(withNext("/login", "/admin")).toBe("/login");
  });

  it("keeps anywhere else", () => {
    expect(withNext("/forgot", "/admin/requests?tab=paid")).toBe("/forgot?next=%2Fadmin%2Frequests%3Ftab%3Dpaid");
  });
});

import { describe, expect, it } from "vitest";
import { isSignInPath, safeNextPath, withNext } from "./next-path";

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/admin/requests?tab=paid")).toBe("/admin/requests?tab=paid");
    expect(safeNextPath("/account")).toBe("/account");
  });

  it("falls back to the start page, which picks each person's home, when missing", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });

  it("rejects other sites", () => {
    expect(safeNextPath("https://example.com")).toBe("/");
    expect(safeNextPath("//example.com")).toBe("/");
    expect(safeNextPath("/\\example.com")).toBe("/");
    expect(safeNextPath("/\t/example.com")).toBe("/");
    expect(safeNextPath("/\n/example.com")).toBe("/");
    expect(safeNextPath("admin")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
  });

  it("never loops back into sign-in", () => {
    expect(safeNextPath("/login")).toBe("/");
    expect(safeNextPath("/login?next=/admin")).toBe("/");
    expect(safeNextPath("/auth/callback")).toBe("/");
    expect(safeNextPath("/./login")).toBe("/");
    expect(safeNextPath("/forgot")).toBe("/");
    expect(safeNextPath("/setup?next=/admin")).toBe("/");
  });

  it("never goes back to the code step", () => {
    expect(safeNextPath("/mfa")).toBe("/");
    expect(safeNextPath("/mfa?next=/account")).toBe("/");
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
    expect(withNext("/login", "/")).toBe("/login");
  });

  it("keeps the dashboard, since not everyone starts there", () => {
    expect(withNext("/login", "/admin")).toBe("/login?next=%2Fadmin");
  });

  it("keeps anywhere else", () => {
    expect(withNext("/forgot", "/admin/requests?tab=paid")).toBe("/forgot?next=%2Fadmin%2Frequests%3Ftab%3Dpaid");
  });
});

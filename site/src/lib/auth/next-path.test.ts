import { describe, expect, it } from "vitest";
import { isApiPath, isSignInPath, safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/people?tab=active")).toBe("/people?tab=active");
    expect(safeNextPath("/account")).toBe("/account");
  });

  it("falls back to the portal home when missing", () => {
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
    expect(safeNextPath("people")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
  });

  it("never loops back into sign-in", () => {
    expect(safeNextPath("/login")).toBe("/");
    expect(safeNextPath("/login?next=/people")).toBe("/");
    expect(safeNextPath("/forgot")).toBe("/");
    expect(safeNextPath("/setup")).toBe("/");
    expect(safeNextPath("/auth/callback")).toBe("/");
    expect(safeNextPath("/./login")).toBe("/");
  });

  it("never loops back into the code step", () => {
    expect(safeNextPath("/mfa")).toBe("/");
    expect(safeNextPath("/mfa?next=/people")).toBe("/");
  });
});

describe("isSignInPath", () => {
  it.each(["/login", "/forgot", "/setup", "/auth/callback"])("is %s", (pathname) => {
    expect(isSignInPath(pathname)).toBe(true);
  });

  it.each(["/", "/people", "/logins", "/forgotten", "/auth", "/account/setup"])("isn't %s", (pathname) => {
    expect(isSignInPath(pathname)).toBe(false);
  });
});

describe("isApiPath", () => {
  it.each(["/api/webhooks/resend", "/api/email/drain", "/api"])("is %s", (pathname) => {
    expect(isApiPath(pathname)).toBe(true);
  });

  it.each(["/", "/apis", "/api-keys", "/people/api", "/login"])("isn't %s", (pathname) => {
    expect(isApiPath(pathname)).toBe(false);
  });
});

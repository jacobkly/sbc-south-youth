import { describe, expect, it } from "vitest";
import { isSignInPath, portalSignInUrl, safeNextPath, withNext } from "./next-path";

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

describe("portalSignInUrl", () => {
  const portal = "https://portal.sbcsouthyouth.com";
  const finances = "https://finances.sbcsouthyouth.com";

  it("sends the page someone was headed to along as a full address", () => {
    expect(portalSignInUrl(portal, "/login", "/admin/requests?tab=paid", finances)).toBe(
      "https://portal.sbcsouthyouth.com/login?next=https%3A%2F%2Ffinances.sbcsouthyouth.com%2Fadmin%2Frequests%3Ftab%3Dpaid",
    );
    expect(portalSignInUrl(portal, "/setup", "/my", finances)).toBe(
      "https://portal.sbcsouthyouth.com/setup?next=https%3A%2F%2Ffinances.sbcsouthyouth.com%2Fmy",
    );
  });

  it("leaves the next page out when there isn't a real one", () => {
    expect(portalSignInUrl(portal, "/login", null, finances)).toBe("https://portal.sbcsouthyouth.com/login");
    expect(portalSignInUrl(portal, "/login", "/", finances)).toBe("https://portal.sbcsouthyouth.com/login");
    expect(portalSignInUrl(portal, "/forgot", "/mfa?next=/admin", finances)).toBe(
      "https://portal.sbcsouthyouth.com/forgot",
    );
  });

  it("never passes along another site", () => {
    expect(portalSignInUrl(portal, "/login", "https://evil.example", finances)).toBe(
      "https://portal.sbcsouthyouth.com/login",
    );
    expect(portalSignInUrl(portal, "/login", "//evil.example/admin", finances)).toBe(
      "https://portal.sbcsouthyouth.com/login",
    );
  });
});

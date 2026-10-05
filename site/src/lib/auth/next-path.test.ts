import { describe, expect, it } from "vitest";
import { isApiPath, isSignInPath, safeNextPath, signedInLoginPath, START_PATH, withNext } from "./next-path";

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

describe("safeNextPath with apps that share the sign-in", () => {
  const finances = ["https://finances.sbcsouthyouth.com"];

  it("allows their pages", () => {
    expect(safeNextPath("https://finances.sbcsouthyouth.com/admin/requests?status=paid", "/", finances)).toBe(
      "https://finances.sbcsouthyouth.com/admin/requests?status=paid",
    );
    expect(safeNextPath("https://finances.sbcsouthyouth.com", "/", finances)).toBe(
      "https://finances.sbcsouthyouth.com/",
    );
  });

  it("still keeps same-site paths", () => {
    expect(safeNextPath("/people", "/start", finances)).toBe("/people");
  });

  it("refuses them unless they're listed", () => {
    expect(safeNextPath("https://finances.sbcsouthyouth.com/admin")).toBe("/");
  });

  it.each([
    "https://evil.example/admin",
    "https://finances.sbcsouthyouth.com.evil.example/admin",
    "http://finances.sbcsouthyouth.com/admin",
    "https://finances.sbcsouthyouth.com:8443/admin",
    "//finances.sbcsouthyouth.com/admin",
    "https://someone@finances.sbcsouthyouth.com/admin",
    "javascript:alert(1)",
  ])("refuses %j", (value) => {
    expect(safeNextPath(value, "/start", finances)).toBe("/start");
  });

  it("never sends someone into their sign-in steps", () => {
    expect(safeNextPath("https://finances.sbcsouthyouth.com/login", "/start", finances)).toBe("/start");
    expect(safeNextPath("https://finances.sbcsouthyouth.com/mfa?next=/admin", "/start", finances)).toBe("/start");
  });
});

describe("withNext", () => {
  it("keeps where to go after", () => {
    expect(withNext("/forgot", "/people?tab=active")).toBe("/forgot?next=%2Fpeople%3Ftab%3Dactive");
    expect(withNext("/login", "https://finances.sbcsouthyouth.com/admin")).toBe(
      "/login?next=https%3A%2F%2Ffinances.sbcsouthyouth.com%2Fadmin",
    );
  });

  it("leaves out the usual place, the Where to? page", () => {
    expect(withNext("/login", START_PATH)).toBe("/login");
    expect(withNext("/login", "/")).toBe("/login?next=%2F");
  });
});

describe("signedInLoginPath", () => {
  it("goes to the start page, or straight to a portal page someone asked for", () => {
    expect(signedInLoginPath(null)).toBe("/start");
    expect(signedInLoginPath("/people?tab=removed")).toBe("/people?tab=removed");
  });

  it("shows every choice instead of going back to another app, which would bounce here again", () => {
    expect(signedInLoginPath("https://finances.example.test/my")).toBe("/start?choose");
    expect(signedInLoginPath("//evil.example/my")).toBe("/start?choose");
    expect(signedInLoginPath("/login")).toBe("/start?choose");
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

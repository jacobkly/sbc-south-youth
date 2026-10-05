import { describe, expect, it } from "vitest";
import { publicSiteUrl, readAppsEnv } from "./env";

describe("readAppsEnv", () => {
  it("points at the live apps and site, each with its own sign-in, when nothing is set", () => {
    expect(readAppsEnv({})).toEqual({
      portalUrl: "https://portal.sbcsouthyouth.com",
      financesUrl: "https://finances.sbcsouthyouth.com",
      siteUrl: "https://sbcsouthyouth.com",
      sharedSignIn: false,
    });
  });

  it("uses the addresses it's given, without a trailing slash", () => {
    expect(
      readAppsEnv({ PORTAL_URL: "http://portal.localhost:3001/", FINANCES_URL: "http://localhost:3000/" }),
    ).toMatchObject({
      portalUrl: "http://portal.localhost:3001",
      financesUrl: "http://localhost:3000",
      siteUrl: "http://localhost:3001",
    });
  });

  it("shares the portal's sign-in once the sign-in cookie has a domain", () => {
    expect(readAppsEnv({ NEXT_PUBLIC_AUTH_COOKIE_DOMAIN: "sbcsouthyouth.com" }).sharedSignIn).toBe(true);
    expect(readAppsEnv({ NEXT_PUBLIC_AUTH_COOKIE_DOMAIN: " " }).sharedSignIn).toBe(false);
    expect(readAppsEnv({ NEXT_PUBLIC_AUTH_COOKIE_NAME: "sbc-staging-auth" }).sharedSignIn).toBe(false);
  });

  it("names a bad variable", () => {
    expect(() => readAppsEnv({ PORTAL_URL: "portal.sbcsouthyouth.com" })).toThrow(/PORTAL_URL/);
    expect(() => readAppsEnv({ FINANCES_URL: "ftp://finances.sbcsouthyouth.com" })).toThrow(/FINANCES_URL/);
    expect(() => readAppsEnv({ NEXT_PUBLIC_AUTH_COOKIE_DOMAIN: "https://x.test" })).toThrow(/COOKIE_DOMAIN/);
  });
});

describe("publicSiteUrl", () => {
  it("drops the portal label, keeping another environment's", () => {
    expect(publicSiteUrl("https://portal.sbcsouthyouth.com")).toBe("https://sbcsouthyouth.com");
    expect(publicSiteUrl("https://portal-staging.sbcsouthyouth.com")).toBe("https://staging.sbcsouthyouth.com");
  });

  it("falls back to the live site for any other address", () => {
    expect(publicSiteUrl("https://example.test")).toBe("https://sbcsouthyouth.com");
    expect(publicSiteUrl("not a url")).toBe("https://sbcsouthyouth.com");
  });
});

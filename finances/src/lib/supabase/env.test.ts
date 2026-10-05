import { describe, expect, it } from "vitest";
import { cookieOptionsFrom, supabaseCookieName } from "./env";

describe("cookieOptionsFrom", () => {
  it("leaves the cookie host-only with Supabase's name when nothing is set", () => {
    expect(cookieOptionsFrom({})).toEqual({});
    expect(cookieOptionsFrom({ name: "", domain: "  " })).toEqual({});
  });

  it("uses the name and domain it's given", () => {
    expect(cookieOptionsFrom({ name: "sbc-auth", domain: "sbcsouthyouth.com" })).toEqual({
      name: "sbc-auth",
      domain: "sbcsouthyouth.com",
    });
    expect(cookieOptionsFrom({ name: " sbc-staging-auth " })).toEqual({ name: "sbc-staging-auth" });
  });

  it("names a shared cookie sbc-auth when no name is set", () => {
    // Supabase's own name is the one each app's old host-only cookie has.
    expect(cookieOptionsFrom({ domain: ".sbcsouthyouth.com" })).toEqual({
      name: "sbc-auth",
      domain: ".sbcsouthyouth.com",
    });
  });

  it.each(["has space", "semi;colon", "equals=sign", "comma,"])("rejects the cookie name %j", (name) => {
    expect(() => cookieOptionsFrom({ name })).toThrow(/NEXT_PUBLIC_AUTH_COOKIE_NAME/);
  });

  it.each(["https://sbcsouthyouth.com", "sbcsouthyouth.com/path", "sbc south.com", "localhost:3001"])(
    "rejects the cookie domain %j",
    (domain) => {
      expect(() => cookieOptionsFrom({ domain })).toThrow(/NEXT_PUBLIC_AUTH_COOKIE_DOMAIN/);
    },
  );
});

describe("supabaseCookieName", () => {
  it("is Supabase's own name for the project's sign-in cookie", () => {
    expect(supabaseCookieName("https://abcdefgh.supabase.co")).toBe("sb-abcdefgh-auth-token");
    expect(supabaseCookieName("http://127.0.0.1:54321")).toBe("sb-127-auth-token");
  });
});

import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./security-headers";

/** The policy as a map from directive name to its sources. */
function directives(policy: string): Record<string, string[]> {
  return Object.fromEntries(
    policy.split("; ").map((directive) => {
      const [name, ...sources] = directive.split(" ");
      return [name, sources];
    }),
  );
}

const production = directives(contentSecurityPolicy({ dev: false, https: true }));

describe("contentSecurityPolicy", () => {
  it("blocks framing, plugins, and other hosts in production", () => {
    expect(production["frame-ancestors"]).toEqual(["'none'"]);
    expect(production["object-src"]).toEqual(["'none'"]);
    expect(production["frame-src"]).toEqual(["'none'"]);
    expect(production["base-uri"]).toEqual(["'self'"]);
    expect(production["form-action"]).toEqual(["'self'"]);
    expect(production["default-src"]).toEqual(["'self'"]);
  });

  it("never allows eval or another script host in production", () => {
    expect(production["script-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(production["connect-src"]).toEqual(["'self'"]);
  });

  it("upgrades insecure requests only over HTTPS", () => {
    expect(production["upgrade-insecure-requests"]).toEqual([]);
    expect(directives(contentSecurityPolicy({ dev: false, https: false }))).not.toHaveProperty("upgrade-insecure-requests");
  });

  it("lets the page reach the hosts it's given", () => {
    const portal = directives(contentSecurityPolicy({ dev: false, https: true, connect: ["https://example-ref.supabase.co"] }));
    expect(portal["connect-src"]).toEqual(["'self'", "https://example-ref.supabase.co"]);
    expect(portal["script-src"]).toEqual(production["script-src"]);
  });

  it("lets the dev server eval and open its reload socket", () => {
    const dev = directives(contentSecurityPolicy({ dev: true, https: false }));
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["connect-src"]).toContain("ws:");
  });
});

describe("securityHeaders", () => {
  it("sends each header once", () => {
    const keys = securityHeaders({ dev: false, https: true }).map((header) => header.key);
    expect(keys).toEqual([
      "Content-Security-Policy",
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
    ]);
  });

  it("keeps sharing and copying available for the share buttons", () => {
    const policy = securityHeaders({ dev: false, https: true }).find((header) => header.key === "Permissions-Policy");
    expect(policy?.value).toContain("camera=()");
    expect(policy?.value).not.toMatch(/web-share|clipboard/);
  });
});

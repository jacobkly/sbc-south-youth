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

  it("shows images from the page's own site unless it's given more sources", () => {
    expect(production["img-src"]).toEqual(["'self'", "data:"]);
    const portal = directives(
      contentSecurityPolicy({ dev: false, https: true, images: ["blob:", "https://example-ref.supabase.co"] }),
    );
    expect(portal["img-src"]).toEqual(["'self'", "data:", "blob:", "https://example-ref.supabase.co"]);
  });

  it("lets a page frame, or be framed by, its own site only when asked", () => {
    const portal = directives(contentSecurityPolicy({ dev: false, https: true, framesSelf: true }));
    expect(portal["frame-src"]).toEqual(["'self'"]);
    expect(portal["frame-ancestors"]).toEqual(["'none'"]);
    const preview = directives(contentSecurityPolicy({ dev: false, https: true, framedBySelf: true }));
    expect(preview["frame-ancestors"]).toEqual(["'self'"]);
    expect(preview["frame-src"]).toEqual(["'none'"]);
  });

  it("lets a form page load and frame Cloudflare Turnstile, and nothing else from there", () => {
    const form = directives(contentSecurityPolicy({ dev: false, https: true, turnstile: true }));
    expect(form["script-src"]).toEqual(["'self'", "'unsafe-inline'", "https://challenges.cloudflare.com"]);
    expect(form["frame-src"]).toEqual(["https://challenges.cloudflare.com"]);
    expect(form["connect-src"]).toEqual(["'self'"]);
    expect(form["frame-ancestors"]).toEqual(["'none'"]);
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

  it("matches the old framing header to the policy", () => {
    const frameOptions = (mode: Parameters<typeof securityHeaders>[0]) =>
      securityHeaders(mode).find((header) => header.key === "X-Frame-Options")?.value;
    expect(frameOptions({ dev: false, https: true })).toBe("DENY");
    expect(frameOptions({ dev: false, https: true, framesSelf: true })).toBe("DENY");
    expect(frameOptions({ dev: false, https: true, framedBySelf: true })).toBe("SAMEORIGIN");
  });

  it("keeps sharing and copying available for the share buttons", () => {
    const policy = securityHeaders({ dev: false, https: true }).find((header) => header.key === "Permissions-Policy");
    expect(policy?.value).toContain("camera=()");
    expect(policy?.value).not.toMatch(/web-share|clipboard/);
  });
});

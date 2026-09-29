/**
 * The security headers on every response.
 *
 * Pages are prerendered, so the policy can't use a fresh nonce per
 * request. Next's inline scripts are allowed instead, but nothing loads
 * from another site: fonts are self-hosted and photos come through
 * `/_next/image`. Blocking framing, other hosts, plugins, and `<base>`
 * tags still stops the common attacks.
 */

type HeaderMode = {
  /** The dev server, which needs eval for React's error overlay and a socket for reloads. */
  dev: boolean;
  /** Served over HTTPS on Vercel. A local `next start` is plain HTTP. */
  https: boolean;
};

export function contentSecurityPolicy({ dev, https }: HeaderMode): string {
  return [
    "default-src 'self'",
    // TODO(wire-up): Turnstile needs https://challenges.cloudflare.com in script-src and frame-src.
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/**
 * Features the site never uses, turned off for it and anything it might
 * embed. Sharing and copying stay on for the share buttons.
 */
const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "browsing-topics=()",
].join(", ");

export function securityHeaders(mode: HeaderMode): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(mode) },
    // For browsers that predate frame-ancestors.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
  ];
}

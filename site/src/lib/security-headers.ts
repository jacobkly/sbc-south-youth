/**
 * The security headers on every response.
 *
 * Pages are prerendered, so the policy can't use a fresh nonce per
 * request. Next's inline scripts are allowed instead, but almost nothing
 * loads from another site: fonts are self-hosted and photos come through
 * `/_next/image`. The portal also shows files from Supabase Storage and
 * photos picked on the device. Blocking framing, other hosts, plugins, and
 * `<base>` tags still stops the common attacks. The frames are the portal's
 * draft preview, which only the portal itself may show, and Cloudflare
 * Turnstile on the public site, for the message forms.
 */

/** Where Turnstile's script and its frame come from. */
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

export type HeaderMode = {
  /** The dev server, which needs eval for React's error overlay and a socket for reloads. */
  dev: boolean;
  /** Served over HTTPS on Vercel. A local `next start` is plain HTTP. */
  https: boolean;
  /** Other origins the page's scripts may call. Only the portal has one: Supabase. */
  connect?: string[];
  /** Other sources the page may show images from. Only the portal has them: Supabase Storage and local previews. */
  images?: string[];
  /** The page may frame its own site. The portal's editors frame their draft preview. */
  framesSelf?: boolean;
  /** Only its own site may frame the page. Just the portal's draft preview. */
  framedBySelf?: boolean;
  /** The public site, whose message forms load and frame Cloudflare Turnstile. */
  turnstile?: boolean;
};

export function contentSecurityPolicy(mode: HeaderMode): string {
  const { dev, https, connect = [], images = [], framesSelf, framedBySelf, turnstile } = mode;
  const frames = [...(framesSelf ? ["'self'"] : []), ...(turnstile ? [TURNSTILE_ORIGIN] : [])];
  const scripts = [...(dev ? ["'unsafe-eval'"] : []), ...(turnstile ? [TURNSTILE_ORIGIN] : [])];
  return [
    "default-src 'self'",
    ["script-src 'self' 'unsafe-inline'", ...scripts].join(" "),
    "style-src 'self' 'unsafe-inline'",
    ["img-src 'self' data:", ...images].join(" "),
    "font-src 'self'",
    ["connect-src 'self'", ...connect, ...(dev ? ["ws:"] : [])].join(" "),
    `frame-src ${frames.length > 0 ? frames.join(" ") : "'none'"}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${framedBySelf ? "'self'" : "'none'"}`,
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
    { key: "X-Frame-Options", value: mode.framedBySelf ? "SAMEORIGIN" : "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
  ];
}

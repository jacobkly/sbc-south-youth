import { z } from "zod";
import { cookieOptionsFrom } from "./supabase/env";

/**
 * Where the other places live, from the server's environment. They're read
 * at build time for static pages, so a change needs a redeploy.
 */
export type AppsEnv = {
  /** The leader portal. */
  portalUrl: string;
  /**
   * This app's own address, which the portal sends people back to after
   * they sign in there. It must match the portal's FINANCES_URL.
   */
  financesUrl: string;
  /** The public site, the portal's address without its `portal` label. */
  siteUrl: string;
  /**
   * Whether finances shares the portal's sign-in. It does once the sign-in
   * cookie has a domain, and then the portal is where everyone signs in.
   */
  sharedSignIn: boolean;
};

const SITE_URL = "https://sbcsouthyouth.com";

/** An http or https address, where a blank value counts as unset. */
const address = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .pipe(z.url({ protocol: /^https?$/, error: "must be an http or https address" }).optional())
  .optional();

const schema = z.object({ PORTAL_URL: address, FINANCES_URL: address });

const withoutSlash = (url: string) => url.replace(/\/+$/, "");

/**
 * The public site that goes with a portal address: the same host without
 * its portal label, so a local portal links to the local site and the
 * staging portal to staging. Anything else gets the real site.
 */
export function publicSiteUrl(portalUrl: string): string {
  try {
    const url = new URL(portalUrl);
    const host = /^portal(?:-([a-z0-9-]+))?\.(.+)$/.exec(url.host);
    if (!host) return SITE_URL;
    const [, environment, rest] = host;
    return `${url.protocol}//${environment ? `${environment}.` : ""}${rest}`;
  } catch {
    return SITE_URL;
  }
}

/** The other places' addresses, naming any bad variable in the error. */
export function readAppsEnv(source: Record<string, string | undefined> = process.env): AppsEnv {
  const result = schema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`);
    throw new Error(`Invalid environment variables: ${problems.join("; ")}`);
  }
  const portalUrl = withoutSlash(result.data.PORTAL_URL ?? "https://portal.sbcsouthyouth.com");
  return {
    portalUrl,
    financesUrl: withoutSlash(result.data.FINANCES_URL ?? "https://finances.sbcsouthyouth.com"),
    siteUrl: publicSiteUrl(portalUrl),
    sharedSignIn: Boolean(cookieOptionsFrom({ domain: source.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN }).domain),
  };
}

/**
 * Public Supabase settings. The publishable key is safe in the browser;
 * Row Level Security decides what it can reach. Only the portal uses
 * them. The public site never loads a Supabase client.
 */
export function supabaseEnv() {
  // Referenced directly so Next inlines them into the client bundle.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill them in.",
    );
  }

  return { url, key, cookieOptions: authCookieOptions() };
}

export type AuthCookieOptions = { name?: string; domain?: string };

// A cookie name is a token: no spaces, separators, or `=`.
const COOKIE_NAME = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;
// A bare domain like `sbcsouthyouth.com`, with an optional leading dot.
const COOKIE_DOMAIN = /^\.?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

/**
 * The sign-in cookie's name and domain. Unset, the cookie stays on this
 * host with Supabase's own name, so the portal and finances each keep
 * their own sign-in. Setting the domain later shares one sign-in across
 * the subdomains, and a different name keeps staging's apart.
 */
export function cookieOptionsFrom(values: { name?: string; domain?: string }): AuthCookieOptions {
  const name = values.name?.trim();
  const domain = values.domain?.trim();
  const options: AuthCookieOptions = {};

  if (name) {
    if (!COOKIE_NAME.test(name)) throw new Error("NEXT_PUBLIC_AUTH_COOKIE_NAME must be a cookie name, like sbc-auth.");
    options.name = name;
  }
  if (domain) {
    if (!COOKIE_DOMAIN.test(domain)) {
      throw new Error("NEXT_PUBLIC_AUTH_COOKIE_DOMAIN must be a domain, like sbcsouthyouth.com.");
    }
    options.domain = domain;
  }
  return options;
}

function authCookieOptions(): AuthCookieOptions {
  // Read directly for the same reason as above: the browser client needs them too.
  return cookieOptionsFrom({
    name: process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME,
    domain: process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN,
  });
}

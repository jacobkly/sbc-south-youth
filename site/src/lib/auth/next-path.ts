const BASE = "http://next.invalid";

/** The portal's sign-in pages, which work while signed out. */
export function isSignInPath(pathname: string): boolean {
  return ["/login", "/forgot", "/setup"].includes(pathname) || pathname.startsWith("/auth/");
}

/**
 * Routes other services call, like Resend's webhook. Each one checks its own
 * signature or secret, so the proxy lets them through without a sign-in.
 */
export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/**
 * Where to send someone after they sign in. Only same-site paths are
 * allowed, so a crafted link can't bounce a user to another site. The path
 * goes through the URL parser, which catches tricks browsers accept, like
 * backslashes or tabs that turn "/" into "//". Paths are the portal host's,
 * like `/people`, never `/portal/people`.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/")) {
    return fallback;
  }

  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) {
    return fallback;
  }

  if (isSignInPath(url.pathname)) {
    return fallback;
  }
  return url.pathname + url.search + url.hash;
}

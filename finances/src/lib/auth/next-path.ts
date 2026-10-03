const BASE = "http://next.invalid";

/** The sign-in pages, which work while signed out. */
export function isSignInPath(pathname: string): boolean {
  return ["/login", "/forgot", "/setup"].includes(pathname) || pathname.startsWith("/auth/");
}

/**
 * Where to send someone after they sign in. Only same-site paths are
 * allowed, so a crafted link can't bounce a user to another site. The
 * fallback is the start page, which sends each person to their home. The path
 * goes through the URL parser, which catches tricks browsers accept, like
 * backslashes or tabs that turn "/" into "//".
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

  // Signed in or not, sending someone back to a sign-in step would loop.
  if (isSignInPath(url.pathname) || url.pathname === "/mfa") {
    return fallback;
  }
  return url.pathname + url.search + url.hash;
}

/** A sign-in page's URL, keeping where to go after unless it's the usual place. */
export function withNext(path: string, next: string): string {
  return next === safeNextPath(null) ? path : `${path}?next=${encodeURIComponent(next)}`;
}

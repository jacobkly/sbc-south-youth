const BASE = "http://next.invalid";

/** The "Where to?" page, where signing in ends unless a link asked for a page. */
export const START_PATH = "/start";

/** The "Where to?" page with every choice, even for someone who only has one app. */
export const CHOOSE_PATH = `${START_PATH}?choose`;

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
 * allowed, plus full addresses on `origins`, the other apps that share
 * this sign-in, so a crafted link can't bounce a user to another site. The
 * value goes through the URL parser, which catches tricks browsers accept,
 * like backslashes or tabs that turn "/" into "//". Paths are the portal
 * host's, like `/people`, never `/portal/people`.
 */
export function safeNextPath(
  value: string | null | undefined,
  fallback = "/",
  origins: readonly string[] = [],
): string {
  if (!value) {
    return fallback;
  }

  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return fallback;
  }
  const local = value.startsWith("/") && url.origin === BASE;
  const otherApp = /^https?:\/\//.test(value) && !url.username && !url.password && origins.some(sameOrigin(url));
  if (!local && !otherApp) {
    return fallback;
  }

  // Signed in or not, sending someone back to a sign-in step would loop.
  if (isSignInPath(url.pathname) || url.pathname === "/mfa") {
    return fallback;
  }
  return local ? url.pathname + url.search + url.hash : url.href;
}

/**
 * Where a visit to /login goes for someone already signed in: the start
 * page, or the portal page a link asked for. Finances sends people here only
 * when it can't see their sign-in, as when its settings don't match the
 * portal's, so going back there would bounce between the two for good. They
 * get every choice instead, and the page doesn't skip ahead.
 */
export function signedInLoginPath(next: string | null): string {
  return next ? safeNextPath(next, CHOOSE_PATH) : START_PATH;
}

/** A sign-in page's URL, keeping where to go after unless it's the usual place. */
export function withNext(path: string, next: string): string {
  return next === START_PATH ? path : `${path}?next=${encodeURIComponent(next)}`;
}

function sameOrigin(url: URL) {
  return (origin: string) => {
    try {
      return new URL(origin).origin === url.origin;
    } catch {
      return false;
    }
  };
}

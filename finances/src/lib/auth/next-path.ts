const BASE = "http://next.invalid";

/**
 * Where to send someone after they sign in. Only same-site paths are
 * allowed, so a crafted link can't bounce a user to another site. The path
 * goes through the URL parser, which catches tricks browsers accept, like
 * backslashes or tabs that turn "/" into "//".
 */
export function safeNextPath(value: string | null | undefined, fallback = "/admin"): string {
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

  if (url.pathname === "/login" || url.pathname.startsWith("/auth/")) {
    return fallback;
  }
  return url.pathname + url.search + url.hash;
}

import { clearAuthCookiesAtScopes, createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSignInPath, portalSignInUrl, safeNextPath } from "@/lib/auth/next-path";
import type { Database } from "@/lib/database.types";
import { readAppsEnv } from "@/lib/env";
import { supabaseCookieName, supabaseEnv } from "@/lib/supabase/env";

function isDevToolPath(pathname: string) {
  return pathname === "/dev" || pathname.startsWith("/dev/");
}

/** The sign-in pages the portal takes over once the sign-in is shared. */
const PORTAL_PAGES = ["/login", "/forgot", "/setup"];

/**
 * Refreshes the Supabase session cookie on every request and sends
 * signed-out visitors to /login. This is a convenience only: RLS is what
 * actually protects the data. Once finances shares the portal's sign-in,
 * /login, /forgot, and /setup live on the portal, and this sends people
 * there with the page they were headed to.
 */
export async function updateSession(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Dev-only tools work without signing in. Those pages 404 in production.
  if (process.env.NODE_ENV !== "production" && isDevToolPath(pathname)) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  let cacheHeaders: Record<string, string> = {};
  const { url, key, cookieOptions } = supabaseEnv();
  const apps = readAppsEnv();

  const supabase = createServerClient<Database>(url, key, {
    cookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        cacheHeaders = { ...cacheHeaders, ...headers };
        for (const [header, value] of Object.entries(headers)) response.headers.set(header, value);
      },
    },
  });

  // Keep this directly after creating the client: it refreshes an expired
  // session and writes the new cookies through setAll above.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  // A sign-in cookie with its own name replaced Supabase's host-only one,
  // which nothing reads anymore. Left alone, it would sit there until it
  // expired, still holding a session.
  const oldCookie = supabaseCookieName(url);
  if (cookieOptions.name && cookieOptions.name !== oldCookie) {
    await clearAuthCookiesAtScopes({
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
      storageKey: oldCookie,
      scopes: [{}],
    });
  }

  function redirectTo(target: URL | string) {
    const redirect = NextResponse.redirect(target);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    for (const [header, value] of Object.entries(cacheHeaders)) redirect.headers.set(header, value);
    return redirect;
  }

  const next = request.nextUrl.searchParams.get("next");

  if (!signedIn && !isSignInPath(pathname)) {
    const page = pathname !== "/" ? pathname + search : null;
    if (apps.sharedSignIn) return redirectTo(portalSignInUrl(apps.portalUrl, "/login", page, apps.financesUrl));
    const login = new URL("/login", request.url);
    if (page) login.searchParams.set("next", page);
    return redirectTo(login);
  }

  if (signedIn && pathname === "/login") {
    return redirectTo(new URL(safeNextPath(next), request.url));
  }

  // Signing in, a forgotten password, and first-time setup all happen on
  // the portal. The links in sign-in emails stay here, under /auth.
  if (apps.sharedSignIn && PORTAL_PAGES.includes(pathname)) {
    return redirectTo(portalSignInUrl(apps.portalUrl, pathname, next, apps.financesUrl));
  }

  return response;
}

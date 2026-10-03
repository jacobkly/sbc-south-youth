import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSignInPath, safeNextPath } from "@/lib/auth/next-path";
import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "@/lib/supabase/env";

function isDevToolPath(pathname: string) {
  return pathname === "/dev" || pathname.startsWith("/dev/");
}

/**
 * Refreshes the Supabase session cookie on every request and sends
 * signed-out visitors to /login. This is a convenience only: RLS is what
 * actually protects the data.
 */
export async function updateSession(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Dev-only tools work without signing in. Those pages 404 in production.
  if (process.env.NODE_ENV !== "production" && isDevToolPath(pathname)) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  let cacheHeaders: Record<string, string> = {};
  const { url, key } = supabaseEnv();

  const supabase = createServerClient<Database>(url, key, {
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

  function redirectTo(target: URL) {
    const redirect = NextResponse.redirect(target);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    for (const [header, value] of Object.entries(cacheHeaders)) redirect.headers.set(header, value);
    return redirect;
  }

  if (!signedIn && !isSignInPath(pathname)) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname + search);
    return redirectTo(login);
  }

  if (signedIn && pathname === "/login") {
    return redirectTo(new URL(safeNextPath(request.nextUrl.searchParams.get("next")), request.url));
  }

  return response;
}

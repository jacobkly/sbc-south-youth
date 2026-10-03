import type { NextRequest, ProxyConfig } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Keeps the portal's sign-in fresh. It runs only on the portal host, so the
 * public site never touches Supabase or sets a cookie.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Next reads this at build time, so it can't import PORTAL_HOST from
  // lib/host. A test keeps the two the same.
  matcher: [
    {
      // Every path except Next's own files, Vercel's scripts, and anything
      // with a file extension (icons, robots.txt, the manifest).
      source: "/((?!_next/|_vercel/)(?!.*\\.[^/]+$).*)",
      has: [{ type: "host", value: "portal(?:-[a-z0-9-]+)?\\..+" }],
    },
  ],
} satisfies ProxyConfig;

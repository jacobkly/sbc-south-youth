import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "@/lib/supabase/env";

/** Supabase client for the portal's Client Components. */
export function createClient() {
  const { url, key, cookieOptions } = supabaseEnv();
  return createBrowserClient<Database>(url, key, { cookieOptions });
}

import { createBrowserClient } from "@supabase/ssr";
import { createClient as createMemoryClient, type AuthError } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "@/lib/supabase/env";

/** Supabase client for the portal's Client Components. */
export function createClient() {
  const { url, key, cookieOptions } = supabaseEnv();
  return createBrowserClient<Database>(url, key, { cookieOptions });
}

/**
 * Checks someone's password without touching this page's sign-in. Signing
 * in again on the page's own client would swap in a new session without
 * the authenticator code, and Supabase won't change the password of a
 * session like that. So it signs in on a separate client that lives only
 * in memory, then ends that extra session.
 */
export async function checkPassword(email: string, password: string): Promise<AuthError | null> {
  const { url, key } = supabaseEnv();
  const scratch = createMemoryClient(url, key, {
    // Its own storage key, so it doesn't share or announce anything with the page's client.
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "password-check" },
  });
  const { error } = await scratch.auth.signInWithPassword({ email, password });
  if (!error) await scratch.auth.signOut({ scope: "local" });
  return error;
}

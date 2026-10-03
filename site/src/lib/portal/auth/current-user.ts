import { cache } from "react";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { Tables } from "@/lib/database.types";
import { type AssuranceLevel, type MfaDevice, verifiedDevices } from "@/lib/portal/auth/mfa";
import { createClient } from "@/lib/supabase/server";

export type PortalUser = Pick<
  Tables<"users">,
  "id" | "full_name" | "email" | "roles" | "is_active" | "avatar_path" | "theme"
>;

/**
 * The signed-in session's checked claims, once per request. Redirects to
 * sign-in when there's no session.
 */
const getClaims = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) {
    redirect("/login");
  }
  return data.claims;
});

/**
 * The signed-in person's account, loaded once per request. Redirects to
 * sign-in when there's no session. Returns null if the account row is
 * missing, which the shell treats as "no access". Once the page is sent,
 * it also marks them as seen.
 */
export const getCurrentUser = cache(async (): Promise<PortalUser | null> => {
  const { sub: userId } = await getClaims();
  const supabase = await createClient();
  const { data: user, error } = await supabase
    .from("users")
    .select("id, full_name, email, roles, is_active, avatar_path, theme")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  // The client is made here because a page can't read cookies inside after().
  if (user?.is_active) after(() => markSeen(supabase));
  return user;
});

/**
 * Records the visit, which the database does at most once an hour. The
 * visit that does also accepts a pending invite, so the first one after
 * setup marks the invite accepted.
 */
async function markSeen(supabase: Awaited<ReturnType<typeof createClient>>): Promise<void> {
  const { data: wrote, error } = await supabase.rpc("touch_last_seen");
  if (error) {
    console.error("[portal] Couldn't record the visit", error);
    return;
  }
  if (!wrote) return;
  const { error: acceptError } = await supabase.rpc("accept_invite");
  if (acceptError) console.error("[portal] Couldn't accept the invite", acceptError);
}

/** "aal2" once this session has entered a code from an authenticator app. */
export async function getSessionAal(): Promise<AssuranceLevel> {
  return (await getClaims()).aal;
}

/**
 * The person's finished authenticator app setups. It asks Supabase Auth
 * directly, so a device added or removed on another phone shows up at once.
 */
export async function getMfaDevices(): Promise<MfaDevice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return verifiedDevices(data.all);
}

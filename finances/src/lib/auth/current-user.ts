import { cache } from "react";
import { redirect } from "next/navigation";
import type { Tables } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { type AssuranceLevel, type MfaDevice, verifiedDevices } from "./mfa";
import { financeRoleFrom } from "./roles";

export type AppUser = Pick<
  Tables<"users">,
  "id" | "full_name" | "email" | "roles" | "is_active" | "avatar_path" | "theme"
> & {
  /** The single role the app's screens check, worked out from roles. */
  role: Tables<"users">["role"];
};

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
 * The signed-in user's app account, loaded once per request. Redirects to
 * sign-in when there's no session. Returns null if the account row is
 * missing, which the shell treats as "no access".
 */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const { sub: userId } = await getClaims();
  const supabase = await createClient();
  const { data: user, error } = await supabase
    .from("users")
    .select("id, full_name, email, roles, is_active, avatar_path, theme")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return user && { ...user, role: financeRoleFrom(user.roles) };
});

/** The signed-in person's id, from the session. Redirects to sign-in when there's no session. */
export const getCurrentUserId = cache(async (): Promise<string> => (await getClaims()).sub);

/**
 * The payee the signed-in person is linked to, which is who their own
 * requests are paid to. Null until an owner links them.
 */
export const getCurrentPayeeId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_payee_id");
  if (error) throw error;
  return data ?? null;
});

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

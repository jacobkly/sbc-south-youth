import { cache } from "react";
import { redirect } from "next/navigation";
import type { Tables } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type AppUser = Pick<Tables<"users">, "id" | "full_name" | "email" | "role" | "is_active" | "avatar_path">;

/**
 * The signed-in user's app account, loaded once per request. Redirects to
 * sign-in when there's no session. Returns null if the account row is
 * missing, which the shell treats as "no access".
 */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) {
    redirect("/login");
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("id, full_name, email, role, is_active, avatar_path")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return user;
});

/** Active admins and viewers can use the app. RLS enforces the same rule on the data. */
export function canUseApp(user: AppUser): boolean {
  return user.is_active && (user.role === "admin" || user.role === "viewer");
}

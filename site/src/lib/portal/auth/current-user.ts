import { cache } from "react";
import { redirect } from "next/navigation";
import type { Tables } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type PortalUser = Pick<
  Tables<"users">,
  "id" | "full_name" | "email" | "roles" | "is_active" | "avatar_path" | "theme"
>;

/**
 * The signed-in person's account, loaded once per request. Redirects to
 * sign-in when there's no session. Returns null if the account row is
 * missing, which the shell treats as "no access".
 */
export const getCurrentUser = cache(async (): Promise<PortalUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) {
    redirect("/login");
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("id, full_name, email, roles, is_active, avatar_path, theme")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return user;
});

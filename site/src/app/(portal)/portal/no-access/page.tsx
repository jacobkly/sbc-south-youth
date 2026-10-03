import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NoAccess } from "@/components/portal/nav/no-access";
import { readPortalEnv } from "@/lib/env";
import { getCurrentUser } from "@/lib/portal/auth/current-user";
import { canUseFinances, canUsePortal } from "@/lib/portal/roles";

export const metadata: Metadata = {
  title: "No access",
};

// It reads the sign-in cookie, so it renders on each request.
export const instant = false;

/** Where the shell sends someone signed in without a portal role. */
export default async function NoAccessPage() {
  const user = await getCurrentUser();
  // Once the owner gives them access, this page sends them in.
  if (user && canUsePortal(user)) redirect("/");

  // Only people who can use finances get a link there.
  const financesUrl = user?.is_active && canUseFinances(user.roles) ? readPortalEnv().financesUrl : null;
  return <NoAccess email={user?.email ?? null} financesUrl={financesUrl} />;
}

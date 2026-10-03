import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cn } from "cn";
import { AccountTheme } from "@/components/account-theme";
import { AdminNav } from "@/components/nav/admin-nav";
import { navFor, type NavUser } from "@/components/nav/nav-items";
import { NoAccess } from "@/components/nav/no-access";
import { RefreshOnHistory } from "@/components/nav/refresh-on-history";
import { getCurrentUser, getSessionAal } from "@/lib/auth/current-user";
import { ownerNeedsMfa } from "@/lib/auth/mfa";
import { type AppArea, canUseArea, financeRoleLabel } from "@/lib/auth/roles";
import { parseSavedTheme } from "@/lib/theme";

/**
 * Role gate and navigation for every signed-in screen, for one area of the
 * app. This is a UX gate: RLS already hides the data from anyone without
 * the role for it.
 */
export async function AppShell({ area, children }: { area: AppArea; children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !canUseArea(user, area)) {
    // Someone with another part of the app gets a way back to it.
    const home = user && canUseArea(user, "account") ? navFor(navUserFrom(user)).home : null;
    return <NoAccess email={user?.email ?? null} home={home && { href: home.href, label: home.label }} />;
  }
  // Owners enter a code from their phone first, or set one up. Signing in
  // usually goes there directly; this catches anyone who skipped ahead.
  if (ownerNeedsMfa(user.roles, await getSessionAal())) redirect("/mfa");

  return (
    <>
      {/* First, so its script applies the account's theme before the page paints. */}
      <AccountTheme userId={user.id} theme={parseSavedTheme(user.theme)} />
      <ShellLayout user={navUserFrom(user)}>{children}</ShellLayout>
    </>
  );
}

function navUserFrom(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>): NavUser {
  return {
    role: user.role,
    requester: user.roles.includes("finance_requester"),
    roleLabel: financeRoleLabel(user.roles),
    name: user.full_name,
    avatarPath: user.avatar_path,
  };
}

/**
 * The navigation and page frame. Under the floating tab bar, the bottom
 * padding keeps content clear of it. Beside the sidebar it widens to 1440px,
 * and pages lay out in columns with `@4xl/main:` and wider container queries.
 * Otherwise it's a 768px column, which never reaches those sizes.
 */
export function ShellLayout({ user, children }: { user: NavUser; children: ReactNode }) {
  return (
    <div className="min-h-dvh rail:pl-18 wide:pl-64">
      <AdminNav {...user} />
      <RefreshOnHistory />
      <main className="@container/main mx-auto w-full max-w-3xl px-4 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 rail:pb-10 wide:max-w-[90rem] wide:px-8 wide:py-10">
        {children}
      </main>
    </div>
  );
}

/** Keeps forms and settings in a readable column, centered in the wide PC frame. */
export function NarrowPage({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-3xl", className)}>{children}</div>;
}

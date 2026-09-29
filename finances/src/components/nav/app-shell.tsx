import type { ReactNode } from "react";
import { cn } from "cn";
import { AccountTheme } from "@/components/account-theme";
import { AdminNav } from "@/components/nav/admin-nav";
import type { NavUser } from "@/components/nav/nav-items";
import { NoAccess } from "@/components/nav/no-access";
import { RefreshOnHistory } from "@/components/nav/refresh-on-history";
import { canUseApp, getCurrentUser } from "@/lib/auth/current-user";
import { parseSavedTheme } from "@/lib/theme";

/**
 * Role gate and navigation for every signed-in screen. This is a UX gate:
 * RLS already hides the data from anyone who isn't an active admin or viewer.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !canUseApp(user)) {
    return <NoAccess email={user?.email ?? null} />;
  }

  return (
    <>
      {/* First, so its script applies the account's theme before the page paints. */}
      <AccountTheme userId={user.id} theme={parseSavedTheme(user.theme)} />
      <ShellLayout role={user.role} name={user.full_name} avatarPath={user.avatar_path}>
        {children}
      </ShellLayout>
    </>
  );
}

/**
 * The navigation and page frame. Under the floating tab bar, the bottom
 * padding keeps content clear of it. Beside the sidebar it widens to 1440px,
 * and pages lay out in columns with `@4xl/main:` and wider container queries.
 * Otherwise it's a 768px column, which never reaches those sizes.
 */
export function ShellLayout({
  role,
  name,
  avatarPath = null,
  children,
}: Omit<NavUser, "avatarPath"> & { avatarPath?: string | null; children: ReactNode }) {
  return (
    <div className="min-h-dvh rail:pl-18 wide:pl-64">
      <AdminNav role={role} name={name} avatarPath={avatarPath} />
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

import type { ReactNode } from "react";
import { FlaskConicalIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { cn } from "cn";
import { AccountTheme } from "@/components/portal/account-theme";
import { PortalNav } from "@/components/portal/nav/portal-nav";
import { RefreshOnHistory } from "@/components/portal/nav/refresh-on-history";
import { readPortalEnv } from "@/lib/env";
import { getCurrentUser } from "@/lib/portal/auth/current-user";
import type { NavUser } from "@/lib/portal/nav-items";
import { canUseFinances, canUsePortal } from "@/lib/portal/roles";
import { parseSavedTheme } from "@/lib/portal/theme";

/**
 * Role gate and navigation for every signed-in screen. This is a UX gate:
 * RLS already hides the data from anyone without the right role.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  // Someone without a portal role gets a page of their own, so no portal
  // page ever renders for them.
  if (!user || !canUsePortal(user)) redirect("/no-access");

  const { appEnv, financesUrl } = readPortalEnv();
  // Only people who can use finances get a link there.
  const financesLink = canUseFinances(user.roles) ? financesUrl : null;
  const staging = appEnv === "staging";
  return (
    <>
      {/* First, so its script applies the account's theme before the page paints. */}
      <AccountTheme userId={user.id} theme={parseSavedTheme(user.theme)} readOnly={staging} />
      <ShellLayout
        user={{ roles: user.roles, name: user.full_name, avatarPath: user.avatar_path, financesUrl: financesLink }}
        staging={staging}
      >
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
export function ShellLayout({ user, staging, children }: { user: NavUser; staging: boolean; children: ReactNode }) {
  return (
    <div className="min-h-dvh rail:pl-18 wide:pl-64">
      <PortalNav {...user} />
      <RefreshOnHistory />
      <main className="@container/main mx-auto w-full max-w-3xl px-4 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 rail:pb-10 wide:max-w-[90rem] wide:px-8 wide:py-10">
        {staging && <StagingBanner />}
        {children}
      </main>
    </div>
  );
}

/** Staging shows real data, so say plainly that nothing here saves. */
function StagingBanner() {
  return (
    <aside
      aria-label="Staging"
      className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
    >
      <FlaskConicalIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        <span className="font-semibold">Staging.</span> This copy of the portal is for checking changes. It shows
        real data, but it can&apos;t save anything.
      </p>
    </aside>
  );
}

/** Keeps forms and settings in a readable column, centered in the wide PC frame. */
export function NarrowPage({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-3xl", className)}>{children}</div>;
}

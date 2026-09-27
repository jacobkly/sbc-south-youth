import type { ReactNode } from "react";
import { cn } from "cn";
import { AdminNav } from "@/components/nav/admin-nav";
import { NoAccess } from "@/components/nav/no-access";
import { RefreshOnHistory } from "@/components/nav/refresh-on-history";
import { canUseApp, getCurrentUser } from "@/lib/auth/current-user";
import type { Enums } from "@/lib/database.types";

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
    <ShellLayout role={user.role} name={user.full_name}>
      {children}
    </ShellLayout>
  );
}

/**
 * The navigation and page frame. The bottom padding keeps content clear of the
 * floating tab bar. On a PC it widens to 1440px, and pages lay out in columns
 * with `@4xl/main:` and wider container queries. Phones and tablets keep the
 * 768px column, which never reaches those sizes, so they don't change.
 */
export function ShellLayout({ role, name, children }: { role: Enums<"user_role">; name: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh desktop:pl-64">
      <AdminNav role={role} name={name} />
      <RefreshOnHistory />
      <main className="@container/main mx-auto w-full max-w-3xl px-4 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 desktop:max-w-[90rem] desktop:px-8 desktop:py-10">
        {children}
      </main>
    </div>
  );
}

/** Keeps forms and settings in a readable column, centered in the wide PC frame. */
export function NarrowPage({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-3xl", className)}>{children}</div>;
}

import type { ReactNode } from "react";
import { AdminNav } from "@/components/nav/admin-nav";
import { NoAccess } from "@/components/nav/no-access";
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

/** The navigation and page frame. The bottom padding keeps content clear of the floating tab bar. */
export function ShellLayout({ role, name, children }: { role: Enums<"user_role">; name: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh desktop:pl-64">
      <AdminNav role={role} name={name} />
      <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 desktop:px-8 desktop:py-10">
        {children}
      </main>
    </div>
  );
}

import type { ReactNode } from "react";
import { AdminNav } from "@/components/nav/admin-nav";
import { NoAccess } from "@/components/nav/no-access";
import { canUseApp, getCurrentUser } from "@/lib/auth/current-user";

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
    <div className="min-h-dvh md:pl-60">
      <AdminNav role={user.role} name={user.full_name} />
      <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:py-10">
        {children}
      </main>
    </div>
  );
}

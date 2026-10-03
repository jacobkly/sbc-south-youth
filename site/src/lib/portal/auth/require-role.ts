import "server-only";
import { assertWritable, ReadOnlyError } from "@/lib/env";
import { getCurrentUser, type PortalUser } from "@/lib/portal/auth/current-user";
import { hasRole, type AppRole } from "@/lib/portal/roles";

/**
 * The signed-in person, when they're active, hold the role (owners hold
 * every role), and aren't on staging. Otherwise, why not, in words the
 * form can show. RLS checks the role again on every write.
 */
export async function requireRole(role: AppRole, refusal: string): Promise<{ me: PortalUser } | { refused: string }> {
  const me = await getCurrentUser();
  if (!me?.is_active || !hasRole(me.roles, role)) return { refused: refusal };
  try {
    assertWritable();
  } catch (error) {
    if (error instanceof ReadOnlyError) return { refused: error.message };
    throw error;
  }
  return { me };
}

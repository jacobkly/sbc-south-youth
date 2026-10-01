import type { Enums } from "@/lib/database.types";

export const ROLE_LABELS: Record<Enums<"user_role">, string> = { admin: "Admin", viewer: "Viewer", member: "Member" };

/** The app's single role from a person's roles list. Matches current_app_role() in the database. */
export function financeRoleFrom(roles: readonly Enums<"app_role">[]): Enums<"user_role"> {
  if (roles.includes("owner")) return "admin";
  if (roles.includes("finance_viewer")) return "viewer";
  return "member";
}

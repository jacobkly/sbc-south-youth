import type { Enums } from "@/lib/database.types";

type AppRole = Enums<"app_role">;

export const ROLE_LABELS: Record<Enums<"user_role">, string> = { admin: "Admin", viewer: "Viewer", member: "Member" };

/** The app's single role from a person's roles list. Matches current_app_role() in the database. */
export function financeRoleFrom(roles: readonly AppRole[]): Enums<"user_role"> {
  if (roles.includes("owner")) return "admin";
  if (roles.includes("finance_viewer")) return "viewer";
  return "member";
}

/** How the app names someone's access, e.g. on their account page. */
export function financeRoleLabel(roles: readonly AppRole[]): string {
  const role = financeRoleFrom(roles);
  return role === "member" && roles.includes("finance_requester") ? "Requester" : ROLE_LABELS[role];
}

/**
 * The parts of the app:
 * - "team" is the dashboard, every request, payees, reports, and settings, for owners and viewers.
 * - "requests" is someone's own requests, for owners and requesters.
 * - "account" is anyone's own account, for everyone who can use either.
 */
export type AppArea = "team" | "requests" | "account";

type RoleHolder = { roles: readonly AppRole[]; is_active: boolean };

/**
 * Whether someone can open a part of the app. Like has_role() in the database,
 * owner counts as every role, and removed access counts as none. RLS enforces
 * the same rules on the data; this only picks which screens to show.
 */
export function canUseArea({ roles, is_active }: RoleHolder, area: AppArea): boolean {
  if (!is_active) return false;
  const has = (role: AppRole) => roles.includes("owner") || roles.includes(role);
  if (area === "team") return has("finance_viewer");
  if (area === "requests") return has("finance_requester");
  return has("finance_viewer") || has("finance_requester");
}

/** Where someone starts: their own requests if that's all they can use, otherwise the dashboard. */
export function homePathFor(user: RoleHolder): string {
  return canUseArea(user, "requests") && !canUseArea(user, "team") ? "/my" : "/admin";
}

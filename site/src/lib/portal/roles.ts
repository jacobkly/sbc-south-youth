import type { Enums } from "@/lib/database.types";

export type AppRole = Enums<"app_role">;

/** Every role, in the order the portal lists them. */
export const APP_ROLES = [
  "owner",
  "finance_viewer",
  "finance_requester",
  "site_editor",
  "site_messages",
] as const satisfies readonly AppRole[];

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Owner",
  finance_viewer: "Finance viewer",
  finance_requester: "Requester",
  site_editor: "Site editor",
  site_messages: "Messages",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  owner: "Everything in the portal and finances, including people, roles, and paying reimbursements.",
  finance_viewer: "Read every submitted request, receipt, and report in finances, without changing anything.",
  finance_requester: "Submit reimbursements with receipt photos in finances, and follow each one until it's paid.",
  site_editor: "Post heads-ups and events, and upload, place, and take down photos.",
  site_messages: "Read and handle Visit, Join, Serve, and Contact messages.",
};

/**
 * Whether someone holds any of these roles. An owner counts as every role,
 * like public.has_role(). Only for what the screens show: RLS decides
 * what anyone can actually read or change.
 */
export function hasRole(roles: readonly AppRole[], ...wanted: AppRole[]): boolean {
  return roles.includes("owner") || wanted.some((role) => roles.includes(role));
}

/** Requesters only use finances. Everyone else with a role uses the portal. */
const PORTAL_ROLES: AppRole[] = ["finance_viewer", "site_editor", "site_messages"];

/** Active people with a portal role can use it. RLS enforces the same on the data. */
export function canUsePortal(user: { is_active: boolean; roles: readonly AppRole[] }): boolean {
  return user.is_active && hasRole(user.roles, ...PORTAL_ROLES);
}

/** Whether someone has a reason to open finances. */
export function canUseFinances(roles: readonly AppRole[]): boolean {
  return hasRole(roles, "finance_viewer", "finance_requester");
}

/** Roles in display order, each once. */
export function sortRoles(roles: readonly AppRole[]): AppRole[] {
  return APP_ROLES.filter((role) => roles.includes(role));
}

/** One line under a name: an owner is just Owner, since that covers the rest. */
export function roleSummary(roles: readonly AppRole[]): string {
  if (roles.includes("owner")) return ROLE_LABELS.owner;
  if (roles.length === 0) return "No roles";
  return sortRoles(roles)
    .map((role) => ROLE_LABELS[role])
    .join(", ");
}

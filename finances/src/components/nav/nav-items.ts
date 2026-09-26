import {
  ChartColumnIcon,
  LayoutDashboardIcon,
  PlusIcon,
  ReceiptTextIcon,
  SettingsIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type { Enums } from "@/lib/database.types";

export type NavItem = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean };

export const DASHBOARD: NavItem = { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon };
export const REQUESTS: NavItem = { href: "/admin/requests", label: "Requests", icon: ReceiptTextIcon };
export const NEW_REQUEST: NavItem = { href: "/admin/requests/new", label: "New", icon: PlusIcon, adminOnly: true };
export const PAYEES: NavItem = { href: "/admin/payees", label: "Payees", icon: UsersIcon };
export const REPORTS: NavItem = { href: "/admin/reports", label: "Reports", icon: ChartColumnIcon };
export const SETTINGS: NavItem = { href: "/admin/settings", label: "Settings", icon: SettingsIcon };
export const ACCOUNT: NavItem = { href: "/account", label: "Account", icon: UserRoundIcon };

export function isActive(pathname: string, href: string): boolean {
  if (href === DASHBOARD.href) return pathname === DASHBOARD.href;
  if (href === REQUESTS.href && pathname.startsWith(NEW_REQUEST.href)) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Hiding an item for viewers is only a convenience; RLS blocks the writes. */
export function allowedFor(role: Enums<"user_role">) {
  return (item: NavItem) => !item.adminOnly || role === "admin";
}

import {
  ChartColumnIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  PlusIcon,
  ReceiptIcon,
  ReceiptTextIcon,
  SettingsIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type { Enums } from "@/lib/database.types";

export type NavItem = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean };

/**
 * The signed-in user, as the navigation shows them. `requester` means they
 * were given the requester role, so they get their own requests too.
 */
export type NavUser = {
  role: Enums<"user_role">;
  requester: boolean;
  roleLabel: string;
  name: string;
  avatarPath: string | null;
};

export const DASHBOARD: NavItem = { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon };
export const REQUESTS: NavItem = { href: "/admin/requests", label: "Requests", icon: ReceiptTextIcon };
export const NEW_REQUEST: NavItem = { href: "/admin/requests/new", label: "New", icon: PlusIcon, adminOnly: true };
export const PAYEES: NavItem = { href: "/admin/payees", label: "Payees", icon: UsersIcon };
export const REPORTS: NavItem = { href: "/admin/reports", label: "Reports", icon: ChartColumnIcon };
export const ACTIVITY: NavItem = { href: "/admin/activity", label: "Activity", icon: HistoryIcon, adminOnly: true };
export const SETTINGS: NavItem = { href: "/admin/settings", label: "Settings", icon: SettingsIcon };
export const ACCOUNT: NavItem = { href: "/account", label: "Account", icon: UserRoundIcon };
export const MY_REQUESTS: NavItem = { href: "/my", label: "My requests", icon: ReceiptIcon };
export const MY_NEW_REQUEST: NavItem = { href: "/my/new", label: "New", icon: PlusIcon };

export function isActive(pathname: string, href: string): boolean {
  if (href === DASHBOARD.href) return pathname === DASHBOARD.href;
  if (href === REQUESTS.href && pathname.startsWith(NEW_REQUEST.href)) return false;
  if (href === MY_REQUESTS.href && pathname.startsWith(MY_NEW_REQUEST.href)) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** What the navigation shows someone, from the phone's tab bar to the desktop sidebar. */
export type Nav = {
  /** Where the logo goes. */
  home: NavItem;
  /** The highlighted New button, if they can start a request. */
  create: NavItem | null;
  tabs: NavItem[];
  /** Behind the phone's More tab. */
  more: NavItem[];
  /** The rail and sidebar's list. */
  main: NavItem[];
  /** Pinned to the bottom of the rail and sidebar. */
  footer: NavItem[];
};

/**
 * The navigation for someone's role. Hiding an item is only a convenience;
 * RLS blocks the data, and each page checks access itself.
 */
export function navFor({ role, requester }: Pick<NavUser, "role" | "requester">): Nav {
  if (role === "member") {
    return {
      home: MY_REQUESTS,
      create: MY_NEW_REQUEST,
      tabs: [MY_REQUESTS, MY_NEW_REQUEST],
      more: [ACCOUNT],
      main: [MY_REQUESTS],
      footer: [],
    };
  }

  const allowed = (item: NavItem) => !item.adminOnly || role === "admin";
  const mine = requester ? [MY_REQUESTS] : [];
  const create = role === "admin" ? NEW_REQUEST : requester ? MY_NEW_REQUEST : null;
  return {
    home: DASHBOARD,
    create,
    tabs: create ? [DASHBOARD, REQUESTS, create, PAYEES] : [DASHBOARD, REQUESTS, PAYEES],
    more: [...mine, REPORTS, ACTIVITY, SETTINGS, ACCOUNT].filter(allowed),
    main: [DASHBOARD, REQUESTS, PAYEES, REPORTS, ACTIVITY, ...mine].filter(allowed),
    footer: [SETTINGS],
  };
}

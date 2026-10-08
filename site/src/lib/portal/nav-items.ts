import {
  CalendarDaysIcon,
  HistoryIcon,
  HouseIcon,
  ImagesIcon,
  InboxIcon,
  MailIcon,
  SettingsIcon,
  Tally5Icon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type { Destination } from "./destinations";
import { hasRole, type AppRole } from "./roles";

/**
 * A link in the portal's navigation. With roles, only those roles (and
 * owners) see it. `also` lists other sections that live under it.
 */
export type NavItem = { href: string; label: string; icon: LucideIcon; roles?: AppRole[]; also?: string[] };

/** The signed-in person, as the navigation shows them. */
export type NavUser = {
  roles: AppRole[];
  name: string;
  avatarPath: string | null;
  /** The places the app switcher offers, this app first. */
  destinations: Destination[];
};

export const HOME: NavItem = { href: "/", label: "Home", icon: HouseIcon };
export const POSTS: NavItem = {
  href: "/posts",
  label: "Posts",
  icon: CalendarDaysIcon,
  roles: ["site_editor"],
  also: ["/events"],
};
export const PHOTOS: NavItem = { href: "/photos", label: "Photos", icon: ImagesIcon, roles: ["site_editor"] };
export const MESSAGES: NavItem = { href: "/messages", label: "Messages", icon: InboxIcon, roles: ["site_messages"] };
export const ATTENDANCE: NavItem = {
  href: "/attendance",
  label: "Attendance",
  icon: Tally5Icon,
  roles: ["attendance", "finance_viewer"],
};
export const ACTIVITY: NavItem = {
  href: "/activity",
  label: "Activity",
  icon: HistoryIcon,
  roles: ["finance_viewer", "site_editor", "site_messages"],
};
export const PEOPLE: NavItem = { href: "/people", label: "People", icon: UsersIcon, roles: ["owner"] };
export const EMAIL: NavItem = { href: "/email", label: "Email", icon: MailIcon, roles: ["owner"] };
export const SETTINGS: NavItem = { href: "/settings", label: "Settings", icon: SettingsIcon };
export const ACCOUNT: NavItem = { href: "/account", label: "Account", icon: UserRoundIcon };

/** The portal's sections, in order. Settings and Account sit apart, in the account menu or More. */
export const MAIN_ITEMS: NavItem[] = [HOME, POSTS, PHOTOS, MESSAGES, ATTENDANCE, ACTIVITY, PEOPLE, EMAIL];

/** Whether a nav item is the current page or the section it's in. */
export function isActive(pathname: string, item: Pick<NavItem, "href" | "also">): boolean {
  if (item.href === HOME.href) return pathname === HOME.href;
  return [item.href, ...(item.also ?? [])].some((href) => pathname === href || pathname.startsWith(`${href}/`));
}

/** Hiding an item is only a convenience: RLS guards the data, and each page checks the role itself. */
export function allowedFor(roles: readonly AppRole[]) {
  return (item: NavItem) => !item.roles || hasRole(roles, ...item.roles);
}

/** The tab bar fits four sections beside More. */
const TAB_COUNT = 4;

/** A phone's tab bar: the first sections as tabs, and the rest under More with Settings and Account. */
export function splitForTabBar(items: NavItem[]): { tabs: NavItem[]; more: NavItem[] } {
  return { tabs: items.slice(0, TAB_COUNT), more: [...items.slice(TAB_COUNT), SETTINGS, ACCOUNT] };
}

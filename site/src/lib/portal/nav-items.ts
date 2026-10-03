import {
  CalendarDaysIcon,
  HistoryIcon,
  HouseIcon,
  ImagesIcon,
  InboxIcon,
  MailIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { hasRole, type AppRole } from "./roles";

/** A link in the portal's navigation. With roles, only those roles (and owners) see it. */
export type NavItem = { href: string; label: string; icon: LucideIcon; roles?: AppRole[] };

/** The signed-in person, as the navigation shows them. */
export type NavUser = {
  roles: AppRole[];
  name: string;
  avatarPath: string | null;
  /** Finances' address for people who use it, or null. */
  financesUrl: string | null;
};

export const HOME: NavItem = { href: "/", label: "Home", icon: HouseIcon };
export const POSTS: NavItem = { href: "/posts", label: "Posts", icon: CalendarDaysIcon, roles: ["site_editor"] };
export const PHOTOS: NavItem = { href: "/photos", label: "Photos", icon: ImagesIcon, roles: ["site_editor"] };
export const MESSAGES: NavItem = { href: "/messages", label: "Messages", icon: InboxIcon, roles: ["site_messages"] };
export const ACTIVITY: NavItem = {
  href: "/activity",
  label: "Activity",
  icon: HistoryIcon,
  roles: ["finance_viewer", "site_editor", "site_messages"],
};
export const PEOPLE: NavItem = { href: "/people", label: "People", icon: UsersIcon, roles: ["owner"] };
export const EMAIL: NavItem = { href: "/email", label: "Email", icon: MailIcon, roles: ["owner"] };
export const ACCOUNT: NavItem = { href: "/account", label: "Account", icon: UserRoundIcon };

/** Every section the portal will have, in order. */
const SECTIONS: NavItem[] = [HOME, POSTS, PHOTOS, MESSAGES, ACTIVITY, PEOPLE, EMAIL];

/**
 * The sections that exist so far, in order. Each joins when its screen is
 * built, so nobody is shown a link to a page that isn't there yet.
 */
export const MAIN_ITEMS: NavItem[] = [HOME, PEOPLE];

/** Sections a person's roles will get that aren't built yet, for Home to mention. */
export function comingSoonFor(roles: readonly AppRole[]): NavItem[] {
  return SECTIONS.filter((item) => !MAIN_ITEMS.includes(item)).filter(allowedFor(roles));
}

export function isActive(pathname: string, href: string): boolean {
  if (href === HOME.href) return pathname === HOME.href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Hiding an item is only a convenience: RLS guards the data, and each page checks the role itself. */
export function allowedFor(roles: readonly AppRole[]) {
  return (item: NavItem) => !item.roles || hasRole(roles, ...item.roles);
}

/** The tab bar fits four sections beside More. */
const TAB_COUNT = 4;

/** A phone's tab bar: the first sections as tabs, and the rest under More with Account. */
export function splitForTabBar(items: NavItem[]): { tabs: NavItem[]; more: NavItem[] } {
  return { tabs: items.slice(0, TAB_COUNT), more: [...items.slice(TAB_COUNT), ACCOUNT] };
}

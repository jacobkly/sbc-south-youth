import { CalendarDays, HandHeart, HeartHandshake, House, Lock, Mail, MapPin, ShieldCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NavTarget } from "@/lib/nav";

export type NavItem = NavTarget & { label: string; icon: LucideIcon };

export type MoreItem = NavItem & { description: string };

/** The four tabs before More in the phone tab bar. */
export const tabs: NavItem[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/this-week", label: "This Week", icon: CalendarDays, also: ["/events"] },
  { href: "/visit", label: "Visit", icon: MapPin },
  { href: "/connect", label: "Connect", icon: HeartHandshake },
];

/** What the More sheet holds on phones. */
export const moreItems: MoreItem[] = [
  { href: "/leaders", label: "Leaders", icon: Users, description: "Meet the people who lead youth" },
  { href: "/parents", label: "Parents & Safety", icon: ShieldCheck, description: "How we look after students" },
  { href: "/give", label: "Give", icon: HandHeart, description: "Help fund camps, trips, and youth nights" },
  { href: "/contact", label: "Contact", icon: Mail, description: "Questions? Send us a message" },
  { href: "/privacy", label: "Privacy", icon: Lock, description: "What our forms collect and why" },
];

/** Desktop top nav. Home is the logo, and Give and Privacy sit elsewhere. */
export const desktopItems: (NavTarget & { label: string })[] = [
  { href: "/this-week", label: "This Week", also: ["/events"] },
  { href: "/visit", label: "Visit" },
  { href: "/connect", label: "Connect" },
  { href: "/leaders", label: "Leaders" },
  { href: "/parents", label: "Parents" },
  { href: "/contact", label: "Contact" },
];

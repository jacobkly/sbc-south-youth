"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartColumnIcon,
  EllipsisIcon,
  LayoutDashboardIcon,
  PlusIcon,
  ReceiptTextIcon,
  SettingsIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { SignOutButton } from "@/components/auth/sign-out-button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Enums } from "@/lib/database.types";

type NavItem = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean };

const DASHBOARD: NavItem = { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon };
const REQUESTS: NavItem = { href: "/admin/requests", label: "Requests", icon: ReceiptTextIcon };
const NEW_REQUEST: NavItem = { href: "/admin/requests/new", label: "New", icon: PlusIcon, adminOnly: true };
const PAYEES: NavItem = { href: "/admin/payees", label: "Payees", icon: UsersIcon };
const REPORTS: NavItem = { href: "/admin/reports", label: "Reports", icon: ChartColumnIcon };
const SETTINGS: NavItem = { href: "/admin/settings", label: "Settings", icon: SettingsIcon };
const ACCOUNT: NavItem = { href: "/account", label: "Account", icon: UserRoundIcon };

const TAB_ITEMS = [DASHBOARD, REQUESTS, NEW_REQUEST, PAYEES];
const MORE_ITEMS = [REPORTS, SETTINGS, ACCOUNT];
const SIDEBAR_ITEMS = [DASHBOARD, REQUESTS, { ...NEW_REQUEST, label: "New request" }, PAYEES, REPORTS, SETTINGS];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  if (href === REQUESTS.href && pathname.startsWith(NEW_REQUEST.href)) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Bottom tab bar on phones, sidebar from the md breakpoint up. Hiding an
 * item for viewers is only a convenience; RLS blocks the writes.
 */
export function AdminNav({ role, name }: { role: Enums<"user_role">; name: string }) {
  const pathname = usePathname();
  const allowed = (item: NavItem) => !item.adminOnly || role === "admin";
  const moreActive = MORE_ITEMS.some((item) => isActive(pathname, item.href));

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="mx-auto flex max-w-md">
          {TAB_ITEMS.filter(allowed).map((item) => {
            const active = isActive(pathname, item.href);
            const isNew = item === NEW_REQUEST;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground outline-none focus-visible:bg-muted",
                    active && "text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center",
                      isNew && "rounded-full bg-primary text-primary-foreground",
                    )}
                  >
                    <item.icon className={isNew ? "size-5" : "size-6"} aria-hidden />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <Sheet>
              <SheetTrigger
                className={cn(
                  "flex h-16 w-full flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground outline-none focus-visible:bg-muted",
                  moreActive && "text-foreground",
                )}
              >
                <span className="flex size-8 items-center justify-center">
                  <EllipsisIcon className="size-6" aria-hidden />
                </span>
                More
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-xl pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <SheetHeader>
                  <SheetTitle>More</SheetTitle>
                  <SheetDescription>Signed in as {name}</SheetDescription>
                </SheetHeader>
                <ul className="px-4">
                  {MORE_ITEMS.filter(allowed).map((item) => (
                    <li key={item.href}>
                      <SheetClose asChild>
                        <Link
                          href={item.href}
                          aria-current={isActive(pathname, item.href) ? "page" : undefined}
                          className="flex h-12 items-center gap-3 rounded-lg px-2 text-base outline-none hover:bg-muted focus-visible:bg-muted aria-[current=page]:font-semibold"
                        >
                          <item.icon className="size-5 text-muted-foreground" aria-hidden />
                          {item.label}
                        </Link>
                      </SheetClose>
                    </li>
                  ))}
                </ul>
                <div className="px-4">
                  <SignOutButton variant="outline" className="h-11 w-full" />
                </div>
              </SheetContent>
            </Sheet>
          </li>
        </ul>
      </nav>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <p className="px-5 pt-6 pb-4 font-semibold tracking-tight">SBC South Youth Finances</p>
        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3">
          <ul className="space-y-1">
            {SIDEBAR_ITEMS.filter(allowed).map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className="flex h-9 items-center gap-3 rounded-lg px-2 text-sm outline-none hover:bg-sidebar-accent focus-visible:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium"
                >
                  <item.icon className="size-4" aria-hidden />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-1 border-t p-3">
          <Link
            href={ACCOUNT.href}
            aria-current={isActive(pathname, ACCOUNT.href) ? "page" : undefined}
            className="flex h-9 items-center gap-3 rounded-lg px-2 text-sm outline-none hover:bg-sidebar-accent focus-visible:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent"
          >
            <UserRoundIcon className="size-4" aria-hidden />
            <span className="truncate">{name}</span>
          </Link>
          <SignOutButton variant="ghost" className="h-9 w-full justify-start px-2" />
        </div>
      </aside>
    </>
  );
}

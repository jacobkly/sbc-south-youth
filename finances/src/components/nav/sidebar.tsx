"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDownIcon, LogOutIcon, PlusIcon, UserRoundIcon } from "lucide-react";
import { useSignOut } from "@/components/auth/sign-out-button";
import { LogoMark } from "@/components/nav/logo-mark";
import {
  ACCOUNT,
  allowedFor,
  DASHBOARD,
  isActive,
  NEW_REQUEST,
  PAYEES,
  REPORTS,
  REQUESTS,
  SETTINGS,
  type NavItem,
} from "@/components/nav/nav-items";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS } from "@/lib/auth/roles";
import type { Enums } from "@/lib/database.types";

const MAIN_ITEMS = [DASHBOARD, REQUESTS, PAYEES, REPORTS];

/** Up to two initials, like "PE" for Pat Example. */
function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean);
  const picked = letters.length > 1 ? [letters[0], letters.at(-1)] : letters;
  return picked.join("").toUpperCase() || "?";
}

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  return (
    <Link
      href={item.href}
      aria-current={isActive(pathname, item.href) ? "page" : undefined}
      className="group flex h-9 items-center gap-3 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground/70 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring aria-[current=page]:bg-background aria-[current=page]:text-sidebar-foreground aria-[current=page]:shadow-xs aria-[current=page]:ring-1 aria-[current=page]:ring-sidebar-border dark:aria-[current=page]:bg-sidebar-accent"
    >
      <item.icon className="size-4 shrink-0 opacity-70 group-aria-[current=page]:opacity-100" aria-hidden />
      {item.label}
    </Link>
  );
}

function AccountMenu({ role, name }: { role: Enums<"user_role">; name: string }) {
  const { pending, signOut } = useSignOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-md p-2 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground"
        >
          {initials(name)}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">{ROLE_LABELS[role]}</span>
        </span>
        <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="min-w-56">
        <DropdownMenuItem asChild className="h-8">
          <Link href={ACCOUNT.href}>
            <UserRoundIcon aria-hidden />
            Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="h-8"
          disabled={pending}
          onSelect={(event) => {
            // Keeps the menu open to show "Signing out…" until the page changes.
            event.preventDefault();
            void signOut();
          }}
        >
          <LogOutIcon aria-hidden />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Navigation on PCs. Phones and tablets get the tab bar instead. */
export function Sidebar({ role, name }: { role: Enums<"user_role">; name: string }) {
  const pathname = usePathname();
  const allowed = allowedFor(role);
  const creating = isActive(pathname, NEW_REQUEST.href);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground desktop:flex">
      <Link
        href={DASHBOARD.href}
        className="m-2 flex items-center gap-3 rounded-lg p-2 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <LogoMark className="size-9" />
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold">SBC South Youth</span>
          <span className="block text-xs text-muted-foreground">Finances</span>
        </span>
      </Link>

      {allowed(NEW_REQUEST) && (
        <div className="px-3 pb-4">
          <Button asChild variant={creating ? "outline" : "default"} className="h-9 w-full justify-start gap-2 px-3">
            <Link href={NEW_REQUEST.href} aria-current={creating ? "page" : undefined}>
              <PlusIcon aria-hidden />
              New request
            </Link>
          </Button>
        </div>
      )}

      <nav aria-label="Main" className="flex flex-1 flex-col overflow-y-auto px-3">
        <ul className="space-y-0.5">
          {MAIN_ITEMS.filter(allowed).map((item) => (
            <li key={item.href}>
              <SidebarLink item={item} pathname={pathname} />
            </li>
          ))}
        </ul>
        <ul className="mt-auto space-y-0.5 pb-3">
          <li>
            <SidebarLink item={SETTINGS} pathname={pathname} />
          </li>
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <AccountMenu role={role} name={name} />
      </div>
    </aside>
  );
}

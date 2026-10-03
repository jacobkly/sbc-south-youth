"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDownIcon, LogOutIcon, ReceiptTextIcon, UserRoundIcon } from "lucide-react";
import { cn } from "cn";
import { useSignOut } from "@/components/portal/auth/sign-out-button";
import { LogoMark } from "@/components/portal/logo-mark";
import { UserAvatar } from "@/components/portal/nav/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/portal/ui/dropdown-menu";
import { ACCOUNT, allowedFor, HOME, isActive, MAIN_ITEMS, type NavItem, type NavUser } from "@/lib/portal/nav-items";
import { roleSummary } from "@/lib/portal/roles";

/** How a sidebar or rail link looks when hovered, focused, or showing the current page. */
export const NAV_LINK_STATES =
  "text-sidebar-foreground/70 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring aria-[current=page]:bg-background aria-[current=page]:text-sidebar-foreground aria-[current=page]:shadow-xs aria-[current=page]:ring-1 aria-[current=page]:ring-sidebar-border dark:aria-[current=page]:bg-sidebar-accent";

const SIDEBAR_LINK_CLASSES = "group flex h-9 items-center gap-3 rounded-md px-2.5 text-sm font-medium touch:h-11";

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  return (
    <Link
      href={item.href}
      aria-current={isActive(pathname, item) ? "page" : undefined}
      className={cn(SIDEBAR_LINK_CLASSES, NAV_LINK_STATES)}
    >
      <item.icon className="size-4 shrink-0 opacity-70 group-aria-[current=page]:opacity-100" aria-hidden />
      {item.label}
    </Link>
  );
}

/**
 * The signed-in person, with Account and Sign out. In the sidebar it shows
 * the name and roles. In the rail it's just the picture, so the menu names
 * them.
 */
export function AccountMenu({ roles, name, avatarPath, compact = false }: NavUser & { compact?: boolean }) {
  const { pending, signOut } = useSignOut();
  const summary = roleSummary(roles);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={compact ? `Account menu for ${name}` : undefined}
        className={cn(
          "flex items-center rounded-md outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent",
          compact ? "size-12 justify-center rounded-full" : "w-full gap-3 p-2 text-left",
        )}
      >
        <UserAvatar name={name} path={avatarPath} className={compact ? "size-9" : undefined} />
        {!compact && (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium">{name}</span>
              <span className="block truncate text-xs text-muted-foreground">{summary}</span>
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={compact ? "right" : "top"} align={compact ? "end" : "start"} className="min-w-56">
        {compact && (
          <>
            <DropdownMenuLabel className="leading-tight">
              <span className="block truncate text-sm font-medium">{name}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">{summary}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
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

/**
 * Navigation on wide screens: PCs, and tablets held sideways, where the links
 * grow to finger size. Narrower PC windows get the rail and phones the tab bar.
 */
export function Sidebar(user: NavUser) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground wide:flex">
      <Link
        href={HOME.href}
        className="m-2 mb-4 flex items-center gap-3 rounded-lg p-2 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <LogoMark className="size-9" />
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold">SBC South Youth</span>
          <span className="block text-xs text-muted-foreground">Portal</span>
        </span>
      </Link>

      <nav aria-label="Main" className="flex flex-1 flex-col overflow-y-auto px-3">
        <ul className="space-y-0.5">
          {MAIN_ITEMS.filter(allowedFor(user.roles)).map((item) => (
            <li key={item.href}>
              <SidebarLink item={item} pathname={pathname} />
            </li>
          ))}
        </ul>
        {user.financesUrl && (
          <ul className="mt-auto space-y-0.5 pb-3">
            <li>
              <a href={user.financesUrl} className={cn(SIDEBAR_LINK_CLASSES, NAV_LINK_STATES)}>
                <ReceiptTextIcon className="size-4 shrink-0 opacity-70" aria-hidden />
                Finances
              </a>
            </li>
          </ul>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <AccountMenu {...user} />
      </div>
    </aside>
  );
}

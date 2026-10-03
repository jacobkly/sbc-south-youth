"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { LogoMark } from "@/components/nav/logo-mark";
import { isActive, navFor, type NavItem, type NavUser } from "@/components/nav/nav-items";
import { AccountMenu, NAV_LINK_STATES } from "@/components/nav/sidebar";

function RailLink({ item, pathname, isNew = false }: { item: NavItem; pathname: string; isNew?: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={isActive(pathname, item.href) ? "page" : undefined}
      className={cn(
        "group flex w-15 flex-col items-center gap-1 rounded-lg pt-2 pb-1.5 text-[0.6875rem] leading-none font-medium",
        NAV_LINK_STATES,
      )}
    >
      <span
        className={cn(
          "flex size-7 items-center justify-center",
          isNew && "rounded-full bg-primary text-primary-foreground shadow-sm",
        )}
      >
        <item.icon
          className={cn(isNew ? "size-4" : "size-5 opacity-70 group-aria-[current=page]:opacity-100")}
          aria-hidden
        />
      </span>
      {item.label}
    </Link>
  );
}

/**
 * Navigation on a PC window too narrow for the sidebar: a slim column of
 * icons with short labels. The account menu sits at the bottom, like the
 * sidebar's.
 */
export function Rail(user: NavUser) {
  const pathname = usePathname();
  const nav = navFor(user);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-18 flex-col items-center border-r border-sidebar-border bg-sidebar text-sidebar-foreground rail:flex">
      <Link
        href={nav.home.href}
        aria-label={`SBC South Youth Finances, ${nav.home.label.toLowerCase()}`}
        className="my-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <LogoMark className="size-10" />
      </Link>

      <nav aria-label="Main" className="flex w-full flex-1 flex-col items-center overflow-y-auto">
        <ul className="flex flex-col items-center gap-1">
          {nav.create && (
            <li>
              <RailLink item={nav.create} pathname={pathname} isNew />
            </li>
          )}
          {nav.main.map((item) => (
            <li key={item.href}>
              <RailLink item={item} pathname={pathname} />
            </li>
          ))}
        </ul>
        <ul className="mt-auto flex flex-col items-center gap-1 pt-4 pb-2">
          {nav.footer.map((item) => (
            <li key={item.href}>
              <RailLink item={item} pathname={pathname} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex w-full justify-center border-t border-sidebar-border py-2">
        <AccountMenu {...user} compact />
      </div>
    </aside>
  );
}

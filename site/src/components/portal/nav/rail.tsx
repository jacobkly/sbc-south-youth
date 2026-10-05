"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { AppSwitcher } from "@/components/portal/nav/app-switcher";
import { AccountMenu, NAV_LINK_STATES } from "@/components/portal/nav/sidebar";
import { allowedFor, isActive, MAIN_ITEMS, type NavUser } from "@/lib/portal/nav-items";

const RAIL_LINK_CLASSES =
  "group flex w-15 flex-col items-center gap-1 rounded-lg pt-2 pb-1.5 text-[0.6875rem] leading-none font-medium";
const RAIL_ICON_CLASSES = "size-5 opacity-70 group-aria-[current=page]:opacity-100";

/**
 * Navigation on a PC window too narrow for the sidebar: a slim column of
 * icons with short labels. The account menu sits at the bottom, like the
 * sidebar's.
 */
export function Rail(user: NavUser) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-18 flex-col items-center border-r border-sidebar-border bg-sidebar text-sidebar-foreground rail:flex">
      <div className="my-2">
        <AppSwitcher destinations={user.destinations} compact />
      </div>

      <nav aria-label="Main" className="flex w-full flex-1 flex-col items-center overflow-y-auto">
        <ul className="flex flex-col items-center gap-1">
          {MAIN_ITEMS.filter(allowedFor(user.roles)).map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(pathname, item) ? "page" : undefined}
                className={cn(RAIL_LINK_CLASSES, NAV_LINK_STATES)}
              >
                <span className="flex size-7 items-center justify-center">
                  <item.icon className={RAIL_ICON_CLASSES} aria-hidden />
                </span>
                {item.label}
              </Link>
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

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ButtonLink } from "@/components/button";
import { isActive } from "@/lib/nav";
import { desktopItems } from "./nav-items";

/** The top nav from 1024 px up. Phones use the bottom tab bar instead. */
export function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {desktopItems.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href}>
              {/* A 40px pill with a 44px tap target, since tablets from 1024 px up are touch screens. */}
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`pressable relative inline-flex h-10 items-center rounded-full px-3.5 text-[0.9375rem] font-medium after:absolute after:inset-x-0 after:-inset-y-0.5 ${
                  active ? "bg-accent-ink/12 text-fg" : "text-muted hover:text-fg"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The one action chip in the top bar. On the Visit page it points to This Week instead. */
export function TopBarAction() {
  const onVisit = isActive(usePathname(), { href: "/visit" });

  return onVisit ? (
    <ButtonLink href="/this-week" size="sm" variant="secondary">
      This week
    </ButtonLink>
  ) : (
    <ButtonLink href="/visit" size="sm">
      Plan a visit
    </ButtonLink>
  );
}

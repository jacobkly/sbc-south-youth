"use client";

import { Ellipsis } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { isActive } from "@/lib/nav";
import { MoreSheet } from "./more-sheet";
import { moreItems, tabs } from "./nav-items";

const tabClasses =
  "pressable flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-full text-[0.6875rem] leading-none";

/** The active tab gets a soft fill and a blue icon, so the accent stays the only color. */
function tabClass(active: boolean) {
  return `${tabClasses} ${active ? "bg-fg/[0.07] font-semibold text-fg" : "font-medium text-muted"}`;
}

function TabFace({ icon: Icon, label, active }: { icon: LucideIcon; label: string; active: boolean }) {
  return (
    <>
      <span className="flex size-7 items-center justify-center">
        <Icon aria-hidden className={`size-[22px] ${active ? "text-accent-ink" : ""}`} strokeWidth={active ? 2.25 : 1.75} />
      </span>
      <span className="max-w-full truncate px-0.5">{label}</span>
    </>
  );
}

/**
 * Phone navigation: four tabs and More in a floating frosted bar, like iOS.
 * Hidden from 1024 px up, and while someone types, so it doesn't ride up
 * on the keyboard and cover the field.
 */
export function BottomTabBar() {
  const pathname = usePathname();
  // The page the sheet was opened on, so moving to a new page closes it.
  const [sheetPath, setSheetPath] = useState<string | null>(null);
  const sheetOpen = sheetPath === pathname;
  const onMorePage = moreItems.some((item) => isActive(pathname, item));

  return (
    <>
      <nav
        aria-label="Primary"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-2 pb-(--tab-bar-gap) min-[22.5rem]:px-3 typing:hidden lg:hidden"
      >
        <ul className="glass pointer-events-auto mx-auto flex max-w-md rounded-full p-1">
          {tabs.map((tab) => {
            const active = !sheetOpen && isActive(pathname, tab);
            return (
              <li key={tab.href} className="min-w-0 flex-1">
                <Link href={tab.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                  <TabFace icon={tab.icon} label={tab.label} active={active} />
                </Link>
              </li>
            );
          })}
          <li className="min-w-0 flex-1">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              onClick={() => setSheetPath(pathname)}
              className={tabClass(sheetOpen || onMorePage)}
            >
              <TabFace icon={Ellipsis} label="More" active={sheetOpen || onMorePage} />
            </button>
          </li>
        </ul>
      </nav>

      <MoreSheet open={sheetOpen} onClose={() => setSheetPath(null)} />
    </>
  );
}

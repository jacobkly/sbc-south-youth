"use client";

import { Ellipsis } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { isActive } from "@/lib/nav";
import { MoreSheet } from "./more-sheet";
import { moreItems, tabs } from "./nav-items";

const tabClasses = "group flex h-full w-full flex-col items-center justify-center gap-1 text-[0.6875rem] leading-none";

/** The icon in a pill, filled with the accent on the active tab. */
function TabFace({ icon: Icon, label, active }: { icon: LucideIcon; label: string; active: boolean }) {
  return (
    <>
      <span
        className={`flex h-8 w-14 items-center justify-center rounded-full transition-[scale,background-color] duration-150 ease-out-soft group-active:scale-90 motion-reduce:transition-none motion-reduce:group-active:scale-100 ${
          active ? "bg-accent text-on-accent" : "text-muted"
        }`}
      >
        <Icon aria-hidden className="size-[22px]" strokeWidth={active ? 2.25 : 1.75} />
      </span>
      <span className={active ? "font-semibold text-fg" : "font-medium text-muted"}>{label}</span>
    </>
  );
}

/** Phone navigation: four tabs and More, fixed above the home indicator. Hidden from 1024 px up. */
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
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
      >
        <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
          {tabs.map((tab) => {
            const active = !sheetOpen && isActive(pathname, tab);
            return (
              <li key={tab.href}>
                <Link href={tab.href} aria-current={active ? "page" : undefined} className={tabClasses}>
                  <TabFace icon={tab.icon} label={tab.label} active={active} />
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              onClick={() => setSheetPath(pathname)}
              className={tabClasses}
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

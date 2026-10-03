"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EllipsisIcon, ReceiptTextIcon } from "lucide-react";
import { cn } from "cn";
import { SignOutButton } from "@/components/portal/auth/sign-out-button";
import { UserAvatar } from "@/components/portal/nav/user-avatar";
import { ResponsiveSheetContent } from "@/components/portal/ui/responsive-sheet";
import {
  Sheet,
  SheetClose,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/portal/ui/sheet";
import { allowedFor, isActive, MAIN_ITEMS, splitForTabBar, type NavUser } from "@/lib/portal/nav-items";

const TAB_CLASSES =
  "flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-full text-[0.6875rem] font-medium text-muted-foreground outline-none transition-[color,background-color,scale] focus-visible:ring-2 focus-visible:ring-ring active:scale-95 motion-reduce:active:scale-100";
const ACTIVE_TAB_CLASSES = "bg-foreground/[0.07] text-foreground";
const SHEET_LINK_CLASSES =
  "flex h-12 items-center gap-3 rounded-lg px-2 text-base outline-none hover:bg-muted focus-visible:bg-muted aria-[current=page]:bg-muted aria-[current=page]:font-semibold";

/**
 * Navigation on phones and upright tablets: a floating frosted bar, like iOS.
 * Wide screens get the sidebar and narrow PC windows the rail instead. It
 * steps aside while the keyboard is up, so the field being typed in has the
 * little room that's left, and comes back after.
 */
export function TabBar({ roles, name, avatarPath, financesUrl }: NavUser) {
  const pathname = usePathname();
  const { tabs, more } = splitForTabBar(MAIN_ITEMS.filter(allowedFor(roles)));
  const moreActive = more.some((item) => isActive(pathname, item));

  return (
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)-0.5rem))] rail:hidden wide:hidden typing:hidden"
    >
      <ul className="glass pointer-events-auto mx-auto flex max-w-md rounded-full p-1">
        {tabs.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(TAB_CLASSES, active && ACTIVE_TAB_CLASSES)}
              >
                <span className="flex size-7 items-center justify-center">
                  <item.icon className="size-[1.375rem]" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                </span>
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="min-w-0 flex-1">
          <Sheet>
            <SheetTrigger className={cn(TAB_CLASSES, moreActive && ACTIVE_TAB_CLASSES)}>
              <span className="flex size-7 items-center justify-center">
                <EllipsisIcon className="size-[1.375rem]" strokeWidth={moreActive ? 2.25 : 1.75} aria-hidden />
              </span>
              <span className="max-w-full truncate px-1">More</span>
            </SheetTrigger>
            <ResponsiveSheetContent>
              <SheetHeader className="flex-row items-center gap-3">
                <UserAvatar name={name} path={avatarPath} className="size-10 text-sm" />
                <div className="min-w-0 space-y-0.5">
                  <SheetTitle>More</SheetTitle>
                  <SheetDescription className="truncate">Signed in as {name}</SheetDescription>
                </div>
              </SheetHeader>
              <ul className="px-4">
                {more.map((item) => (
                  <li key={item.href}>
                    <SheetClose asChild>
                      <Link
                        href={item.href}
                        aria-current={isActive(pathname, item) ? "page" : undefined}
                        className={SHEET_LINK_CLASSES}
                      >
                        <item.icon className="size-5 text-muted-foreground" aria-hidden />
                        {item.label}
                      </Link>
                    </SheetClose>
                  </li>
                ))}
                {financesUrl && (
                  <li>
                    <a href={financesUrl} className={SHEET_LINK_CLASSES}>
                      <ReceiptTextIcon className="size-5 text-muted-foreground" aria-hidden />
                      Finances
                    </a>
                  </li>
                )}
              </ul>
              <div className="px-4">
                <SignOutButton variant="outline" className="h-11 w-full" />
              </div>
            </ResponsiveSheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EllipsisIcon } from "lucide-react";
import { cn } from "cn";
import { SignOutButton } from "@/components/auth/sign-out-button";
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
} from "@/components/nav/nav-items";
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

const TAB_ITEMS = [DASHBOARD, REQUESTS, NEW_REQUEST, PAYEES];
const MORE_ITEMS = [REPORTS, SETTINGS, ACCOUNT];

const TAB_CLASSES =
  "flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-full text-[0.6875rem] font-medium text-muted-foreground outline-none transition-[color,background-color,scale] focus-visible:ring-2 focus-visible:ring-ring active:scale-95 motion-reduce:active:scale-100";
const ACTIVE_TAB_CLASSES = "bg-foreground/[0.07] text-foreground";

/**
 * Navigation on phones and tablets: a floating frosted bar, like iOS. PCs get
 * the sidebar instead.
 */
export function TabBar({ role, name }: { role: Enums<"user_role">; name: string }) {
  const pathname = usePathname();
  const allowed = allowedFor(role);
  const moreActive = MORE_ITEMS.some((item) => isActive(pathname, item.href));

  return (
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)-0.5rem))] desktop:hidden"
    >
      <ul className="glass pointer-events-auto mx-auto flex max-w-md rounded-full p-1">
        {TAB_ITEMS.filter(allowed).map((item) => {
          const active = isActive(pathname, item.href);
          const isNew = item === NEW_REQUEST;
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(TAB_CLASSES, active && ACTIVE_TAB_CLASSES)}
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center",
                    isNew && "rounded-full bg-primary text-primary-foreground shadow-sm",
                  )}
                >
                  <item.icon className={isNew ? "size-4.5" : "size-[1.375rem]"} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
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
            <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]">
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
                        className="flex h-12 items-center gap-3 rounded-lg px-2 text-base outline-none hover:bg-muted focus-visible:bg-muted aria-[current=page]:bg-muted aria-[current=page]:font-semibold"
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
  );
}

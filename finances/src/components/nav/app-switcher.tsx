"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import {
  ArrowUpRightIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  GlobeIcon,
  PanelsTopLeftIcon,
  ReceiptTextIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { LogoMark } from "@/components/nav/logo-mark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AppKey, Destination } from "@/lib/destinations";

/** This app. The portal keeps its own copy of the switcher, set to "portal". */
const CURRENT: AppKey = "finances";

const APP_ICONS: Record<AppKey, LucideIcon> = {
  portal: PanelsTopLeftIcon,
  finances: ReceiptTextIcon,
  site: GlobeIcon,
};

/** A place's icon on a small tile. */
export function AppTile({ app, className }: { app: AppKey; className?: string }) {
  const Icon = APP_ICONS[app];
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-foreground",
        className,
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

/**
 * A link to one of the places someone can go. The app they're in links to
 * its home with the router. The others are full page loads, since each is
 * its own site.
 */
export function DestinationLink({
  destination,
  ...props
}: Omit<ComponentProps<"a">, "href"> & { destination: Destination }) {
  // The menu passes its item's props and ref through to the link.
  if (destination.key === CURRENT) return <Link href={destination.href} {...props} />;
  return <a href={destination.href} {...props} />;
}

/** The mark beside a place: a check on the app someone's in, and an arrow for the public site. */
export function DestinationMark({ app }: { app: AppKey }) {
  if (app === CURRENT) return <CheckIcon className="size-4 shrink-0" aria-label="Current" />;
  if (app === "site") return <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
  return null;
}

/**
 * The name at the top of the sidebar and rail, which opens a menu of the
 * places this person can go: finances, the portal if their roles open it,
 * and the public site. In the rail it's just the logo.
 */
export function AppSwitcher({ destinations, compact = false }: { destinations: Destination[]; compact?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={compact ? "SBC South Youth Finances, switch apps" : undefined}
        className={cn(
          "flex items-center rounded-lg outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent",
          compact ? "size-12 justify-center" : "w-full gap-3 p-2 text-left",
        )}
      >
        <LogoMark className={compact ? "size-10" : "size-9"} />
        {!compact && (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-semibold">SBC South Youth</span>
              <span className="block text-xs text-muted-foreground">Finances</span>
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={compact ? "right" : "bottom"} align="start" className="w-72">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Switch to</DropdownMenuLabel>
        {destinations.map((destination) => (
          <DropdownMenuItem key={destination.key} asChild className="gap-3 py-2">
            <DestinationLink destination={destination}>
              <AppTile app={destination.key} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block font-medium">{destination.name}</span>
                <span className="block text-xs text-muted-foreground">{destination.description}</span>
              </span>
              <DestinationMark app={destination.key} />
            </DestinationLink>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

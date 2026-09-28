import Link from "next/link";
import { ButtonLink } from "@/components/button";
import { readServerEnv } from "@/lib/env";
import { DesktopNav, TopBarAction } from "./desktop-nav";
import { LogoMark } from "./logo";

/**
 * Logo on the left and one action on the right. It scrolls away on phones,
 * where the tab bar stays put, and sticks to the top on desktop.
 */
export function TopBar() {
  const { giveCashtag } = readServerEnv();

  return (
    <header className="relative z-30 pt-[env(safe-area-inset-top)] lg:sticky lg:top-0 lg:border-b lg:border-line lg:bg-bg/80 lg:backdrop-blur-xl lg:backdrop-saturate-150">
      <div className="page-x flex h-16 items-center justify-between gap-6 lg:h-[4.5rem]">
        <Link
          href="/"
          className="pressable -mx-1 flex h-11 shrink-0 items-center gap-2.5 rounded-full px-1 font-display text-[1.0625rem] leading-none font-extrabold tracking-tight"
        >
          <LogoMark className="h-8" />
          <span>
            SBC South <span className="text-accent-ink">Youth</span>
          </span>
          <span className="sr-only">, home</span>
        </Link>

        <DesktopNav />

        <div className="flex items-center gap-2">
          {/* The Give button waits until there's a cashtag to give to. */}
          {giveCashtag && (
            <ButtonLink href="/give" size="sm" variant="secondary" className="hidden lg:inline-flex">
              Give
            </ButtonLink>
          )}
          <TopBarAction />
        </div>
      </div>
    </header>
  );
}

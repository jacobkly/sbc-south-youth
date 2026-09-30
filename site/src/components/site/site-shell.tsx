import type { ReactNode } from "react";
import { BottomTabBar } from "./bottom-tab-bar";
import { SiteFooter } from "./site-footer";
import { TopBar } from "./top-bar";

/**
 * The chrome around every public page: skip link, top bar, footer, and the
 * phone tab bar. The bottom padding is the floating tab bar's height (66 px),
 * its gap above the home indicator, and 12 px to spare, so the end of every
 * page scrolls clear of it.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-[calc(env(safe-area-inset-top)+0.75rem)] focus:left-4 focus:z-50 focus:inline-flex focus:h-11 focus:items-center focus:rounded-full focus:bg-accent focus:px-5 focus:font-semibold focus:text-on-accent"
      >
        Skip to content
      </a>
      <div className="flex min-h-dvh flex-col pb-[calc(4.875rem+var(--tab-bar-gap))] lg:pb-0">
        <TopBar />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <SiteFooter />
      </div>
      <BottomTabBar />
    </>
  );
}

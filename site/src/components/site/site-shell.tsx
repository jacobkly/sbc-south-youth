import type { ReactNode } from "react";
import { BottomTabBar } from "./bottom-tab-bar";
import { SiteFooter } from "./site-footer";
import { TopBar } from "./top-bar";

/**
 * The chrome around every public page: skip link, top bar, footer, and the
 * phone tab bar. The bottom padding keeps the footer clear of the tab bar.
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
      <div className="flex min-h-dvh flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
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

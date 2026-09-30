import type { ReactNode } from "react";

/**
 * The top of a page: its h1 and a short lede. From xl up it spans the
 * frame: the lede moves beside the title, or, with an aside, stays under
 * it while the aside takes the right. The aside isn't shown below xl, so
 * the page must also put it somewhere else.
 */
export function PageIntro({ title, children, aside }: { title: ReactNode; children?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="page-x pt-4 pb-8 lg:pt-16 lg:pb-12 xl:grid xl:grid-cols-12 xl:items-end xl:gap-x-(--grid-gap)">
      <h1 className="max-w-3xl font-display text-h1 text-balance xl:col-span-7">{title}</h1>
      {children && (
        <div
          className={`mt-4 max-w-xl text-pretty text-muted ${aside ? "xl:col-span-7" : "xl:col-span-5 xl:col-start-8 xl:row-start-1 xl:mt-0 xl:justify-self-end"}`}
        >
          {children}
        </div>
      )}
      {aside && (
        <div className="hidden xl:col-span-5 xl:col-start-8 xl:row-span-2 xl:row-start-1 xl:block xl:self-end xl:justify-self-end">
          {aside}
        </div>
      )}
    </header>
  );
}

import type { ReactNode } from "react";

/** The headline and lede at the top of an inner page. */
export function PageIntro({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-x pt-4 pb-8 lg:pt-16 lg:pb-12">
      <h1 className="max-w-3xl font-display text-h1 text-balance">{title}</h1>
      {children && <div className="mt-4 max-w-xl text-pretty text-muted">{children}</div>}
    </header>
  );
}

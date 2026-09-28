import type { ReactNode } from "react";

/** The eyebrow and title that open a section, with an optional lede and action. */
export function SectionHeader({
  id,
  eyebrow,
  title,
  action,
  children,
}: {
  /** The heading's id, for `aria-labelledby` on the section. */
  id?: string;
  eyebrow: string;
  title: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="max-w-2xl">
        <p className="text-eyebrow text-accent-ink uppercase">{eyebrow}</p>
        <h2 id={id} className="mt-2 font-display text-h2 text-balance">
          {title}
        </h2>
        {children && <div className="mt-3 text-pretty text-muted">{children}</div>}
      </div>
      {action}
    </div>
  );
}

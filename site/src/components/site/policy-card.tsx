import type { ReactNode } from "react";
import { Tag } from "@/components/tag";
import type { PolicyPoint } from "@/content/safety";

/** Marks wording leadership hasn't approved yet, so reviewers can spot it. */
export function PendingTag() {
  return <Tag tone="pending">To confirm</Tag>;
}

/**
 * One commitment or policy: an icon, a title, what it means, and an
 * optional action. From xl up it drops the card for a row, with the icon
 * beside the text, so the list around it should draw the rules.
 */
export function PolicyCard({ point, icon, children }: { point: PolicyPoint; icon: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex h-full flex-col rounded-card bg-surface p-5 ring-1 ring-line ring-inset sm:p-6 xl:flex-row xl:items-start xl:gap-5 xl:rounded-none xl:bg-transparent xl:px-0 xl:py-6 xl:ring-0">
      <div className="flex items-start justify-between gap-3 xl:contents">
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-on-accent [&_svg]:size-5"
        >
          {icon}
        </span>
        {!point.confirmed && (
          <span className="xl:order-last">
            <PendingTag />
          </span>
        )}
      </div>
      <div className="mt-6 flex flex-1 flex-col xl:mt-0">
        <h3 className="text-h3">{point.title}</h3>
        <p className="mt-1.5 max-w-[36em] text-pretty text-muted">{point.body}</p>
        {children && <div className="mt-auto pt-6 xl:pt-4">{children}</div>}
      </div>
    </div>
  );
}

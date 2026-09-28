import type { ReactNode } from "react";
import { Tag } from "@/components/tag";
import type { PolicyPoint } from "@/content/safety";

/** Marks wording leadership hasn't approved yet, so reviewers can spot it. */
export function PendingTag() {
  return <Tag tone="pending">To confirm</Tag>;
}

/** One safety commitment: an icon, a title, and what it means. */
export function PolicyCard({ point, icon }: { point: PolicyPoint; icon: ReactNode }) {
  return (
    <div className="h-full rounded-card bg-surface p-5 ring-1 ring-line ring-inset sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <span aria-hidden className="grid size-12 place-items-center rounded-full bg-accent text-on-accent [&_svg]:size-5">
          {icon}
        </span>
        {!point.confirmed && <PendingTag />}
      </div>
      <h3 className="mt-6 text-h3">{point.title}</h3>
      <p className="mt-1.5 text-pretty text-muted">{point.body}</p>
    </div>
  );
}

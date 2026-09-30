import { Plus } from "lucide-react";
import type { FaqItem } from "@/lib/content/types";

/**
 * Questions that open one at a time. Built on `details` and `summary`, so
 * it works without JS, and the browser's find-in-page opens a match.
 */
export function FaqAccordion({ items, name, className = "" }: { items: FaqItem[]; name: string; className?: string }) {
  return (
    <div className={`divide-y divide-line border-y border-line ${className}`}>
      {items.map((item) => (
        <details key={item.question} name={name} className="group">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-h3 select-none [&::-webkit-details-marker]:hidden">
            {item.question}
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-fg ring-1 ring-line ring-inset transition-[rotate,background-color] duration-200 ease-out-soft group-open:rotate-45 group-open:bg-accent group-open:text-on-accent motion-reduce:transition-none"
            >
              <Plus className="size-5" />
            </span>
          </summary>
          {/* About 70 characters a line, whatever the list's width. */}
          <div className="max-w-[36em] space-y-3 pr-12 pb-6 text-pretty text-muted">
            {item.answer.split(/\n\s*\n/).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

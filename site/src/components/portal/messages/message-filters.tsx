import Link from "next/link";
import {
  KIND_LABELS,
  MESSAGE_KINDS,
  MESSAGE_TABS,
  messagesHref,
  TAB_LABELS,
  type MessageFilters,
  type MessageTab,
} from "@/lib/portal/messages/list";

const TAB =
  "inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium " +
  "text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 " +
  "aria-[current=page]:bg-background aria-[current=page]:text-foreground aria-[current=page]:shadow-sm " +
  "dark:aria-[current=page]:bg-input/30";

const CHIP =
  "inline-flex h-10 shrink-0 items-center rounded-full border bg-card px-3.5 text-sm font-medium outline-none " +
  "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 " +
  "aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground";

/** New, In progress, and Handled, each with how many it holds. */
export function MessageTabs({
  filters,
  counts,
}: {
  filters: MessageFilters;
  counts: Record<MessageTab, number> | null;
}) {
  return (
    <nav aria-label="Status" className="flex w-full rounded-lg bg-muted p-[3px] sm:w-fit">
      {MESSAGE_TABS.map((tab) => (
        <Link
          key={tab}
          href={messagesHref(filters, { tab })}
          aria-current={tab === filters.tab ? "page" : undefined}
          className={`${TAB} sm:min-w-32`}
        >
          {TAB_LABELS[tab]}
          {counts && <span className="text-xs tabular-nums opacity-70">{counts[tab]}</span>}
        </Link>
      ))}
    </nav>
  );
}

/** Every kind, or one form's messages. On a phone the chips scroll sideways. */
export function MessageKindChips({ filters }: { filters: MessageFilters }) {
  const kinds = [{ kind: "all", label: "All" } as const, ...MESSAGE_KINDS.map((kind) => ({ kind, label: KIND_LABELS[kind] }))];
  return (
    <nav aria-label="Kind of message" className="-mx-4 [scrollbar-width:none] overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2 pb-1 sm:w-auto sm:flex-wrap">
        {kinds.map(({ kind, label }) => (
          <li key={kind}>
            <Link
              href={messagesHref(filters, { kind })}
              aria-current={kind === filters.kind ? "page" : undefined}
              className={CHIP}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

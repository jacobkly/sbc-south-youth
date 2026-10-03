import Link from "next/link";

const KINDS = [
  { href: "/posts", label: "Heads-ups" },
  { href: "/events", label: "Events" },
] as const;

const KIND =
  "inline-flex h-10 flex-1 items-center justify-center rounded-md px-4 text-sm font-medium text-muted-foreground " +
  "outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 " +
  "aria-[current=page]:bg-background aria-[current=page]:text-foreground aria-[current=page]:shadow-sm " +
  "dark:aria-[current=page]:bg-input/30";

/** Switches Posts between heads-ups and events, which share its place in the navigation. */
export function PostKinds({ current }: { current: (typeof KINDS)[number]["href"] }) {
  return (
    <nav aria-label="Kind of post" className="flex w-full rounded-lg bg-muted p-[3px] sm:w-fit">
      {KINDS.map((kind) => (
        <Link
          key={kind.href}
          href={kind.href}
          aria-current={kind.href === current ? "page" : undefined}
          className={`${KIND} sm:min-w-28`}
        >
          {kind.label}
        </Link>
      ))}
    </nav>
  );
}

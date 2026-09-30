type Section = { id: string; label: string };

/**
 * Links that jump to the sections of a long page.
 *
 * - `row`: a row of chips that scrolls sideways on phones.
 * - `end`: chips that wrap from the right, to sit beside a page's heading.
 * - `index`: a list down the side of the page, for a sticky column. Where
 *   the browser supports it, the section on screen lights up with no script.
 */
export function JumpNav({
  sections,
  layout = "row",
  className = "",
}: {
  sections: Section[];
  layout?: "row" | "end" | "index";
  className?: string;
}) {
  if (layout === "index") return <IndexNav sections={sections} className={className} />;

  const list =
    layout === "end"
      ? "flex flex-wrap justify-end gap-2"
      : "-mx-(--gutter) flex gap-2 overflow-x-auto px-(--gutter) pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0";

  return (
    <nav aria-label="On this page" className={`${layout === "row" ? "page-x" : ""} ${className}`}>
      <ul className={list}>
        {sections.map((section) => (
          <li key={section.id} className="shrink-0">
            <a
              href={`#${section.id}`}
              className="pressable inline-flex h-11 items-center rounded-full bg-surface px-4 text-[0.9375rem] font-medium ring-1 ring-line ring-inset hover:bg-surface-2"
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function IndexNav({ sections, className }: { sections: Section[]; className: string }) {
  return (
    <nav aria-label="On this page" className={className}>
      <p className="text-eyebrow text-muted uppercase">On this page</p>
      {/* scroll-target-group marks the link to the section on screen as :target-current. */}
      <ul className="mt-4 border-l border-line [scroll-target-group:auto]">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="-ml-px flex min-h-11 items-center border-l-2 border-transparent pl-4 font-medium text-muted hover:text-fg [&:target-current]:border-accent-ink [&:target-current]:text-fg"
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

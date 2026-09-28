/** A row of chips that jump to the sections of a long page. Scrolls sideways on phones. */
export function JumpNav({ sections }: { sections: { id: string; label: string }[] }) {
  return (
    <nav aria-label="On this page" className="page-x">
      <ul className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0">
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

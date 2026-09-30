/**
 * A numbered sequence. On phones the numbers run down the left, joined by
 * a line; from `lg` the steps sit side by side under a rule. `className`
 * goes on the list, for a narrower column to wrap them two by two.
 */
export function Steps({ steps, className = "" }: { steps: { title: string; body: string }[]; className?: string }) {
  return (
    <ol className={`grid gap-x-6 lg:grid-cols-4 ${className}`}>
      {steps.map((step, index) => (
        <li
          key={step.title}
          className="relative flex gap-5 pb-8 last:pb-0 lg:flex-col lg:gap-4 lg:border-t lg:border-line lg:pt-6 lg:pb-0"
        >
          {/* The line that joins the numbers on phones. */}
          {index < steps.length - 1 && (
            <span aria-hidden className="absolute top-12 bottom-1 left-[1.375rem] w-px bg-line-strong lg:hidden" />
          )}
          <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-accent font-display text-[1.0625rem] font-extrabold text-on-accent">
            {index + 1}
          </span>
          {/* Keeps tablet lines to about 70 characters. */}
          <div className="max-w-[34em] pt-2 lg:pt-0">
            <h3 className="text-h3">{step.title}</h3>
            <p className="mt-1 text-pretty text-muted">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

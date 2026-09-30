import { home } from "@/content/home";

const { friday } = home;

/**
 * A Friday from start to finish, on one line. Desktop only: phones get
 * the same night from the hero, and Plan a Visit walks through it.
 */
export function FridayTimeline() {
  return (
    <section
      aria-labelledby="friday-title"
      className="page-x mt-16 hidden lg:grid lg:grid-cols-12 lg:gap-x-(--grid-gap) xl:mt-20"
    >
      <h2 id="friday-title" className="col-span-3 font-display text-h2 text-balance">
        {friday.title}
      </h2>
      <ol className="col-span-9 grid grid-cols-4 gap-x-(--grid-gap) self-end border-t border-line-strong">
        {friday.stops.map((stop) => (
          <li key={stop.title} className="relative pt-6">
            {/* A stop on the line. */}
            <span aria-hidden className="absolute -top-[5.5px] left-0 size-2.5 rounded-full bg-accent" />
            <p className="text-small font-semibold text-accent-ink">{stop.time}</p>
            <h3 className="mt-1 font-display text-h3 2xl:text-[1.5rem]">{stop.title}</h3>
            <p className="mt-1 text-pretty text-muted">{stop.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

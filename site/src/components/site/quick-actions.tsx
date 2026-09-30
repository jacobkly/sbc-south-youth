import { ArrowRight, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { home } from "@/content/home";

const icons = { new: Sparkles, chat: MessageCircle, parents: ShieldCheck };

/**
 * The three most common reasons someone lands on the home page. Tiles on
 * phones and tablets, and a row of big links between hairlines on desktop.
 */
export function QuickActions() {
  return (
    <nav aria-labelledby="quick-actions-title" className="page-x mt-6 lg:mt-8">
      <h2 id="quick-actions-title" className="sr-only">
        Start here
      </h2>
      <ul className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-0 lg:divide-x lg:divide-line lg:border-y lg:border-line">
        {home.quickActions.map((action) => {
          const Icon = icons[action.icon];
          return (
            <li key={action.href} className="lg:px-(--grid-gap) lg:first:pl-0 lg:last:pr-0">
              <Link
                href={action.href}
                className="group pressable relative flex h-full min-h-28 flex-col justify-between gap-4 rounded-tile bg-surface p-3.5 ring-1 ring-line ring-inset hover:bg-surface-2 sm:p-5 lg:min-h-0 lg:flex-row lg:items-center lg:gap-6 lg:rounded-none lg:bg-transparent lg:px-0 lg:py-8 lg:ring-0 lg:hover:bg-transparent"
              >
                <span className="grid size-10 place-items-center rounded-full bg-accent text-on-accent lg:hidden">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span>
                  <span className="block font-display text-base leading-tight font-bold text-balance transition-colors sm:text-h3 lg:text-[clamp(1.75rem,0.75rem+1.5vw,2.75rem)] lg:group-hover:text-accent-ink">
                    {action.title}
                  </span>
                  <span className="mt-1 hidden text-small text-pretty text-muted sm:block lg:mt-2 lg:text-body">
                    {action.body}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden
                  className="absolute top-5 right-5 hidden size-5 shrink-0 text-muted transition-transform duration-200 ease-out-soft group-hover:translate-x-1 motion-reduce:transition-none sm:block lg:static lg:size-7 lg:group-hover:text-accent-ink"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

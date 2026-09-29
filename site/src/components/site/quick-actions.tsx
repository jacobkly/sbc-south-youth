import { ArrowRight, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { home } from "@/content/home";

const icons = { new: Sparkles, chat: MessageCircle, parents: ShieldCheck };

/** The three most common reasons someone lands on the home page. */
export function QuickActions() {
  return (
    <nav aria-labelledby="quick-actions-title" className="page-x mt-6 lg:mt-8">
      <h2 id="quick-actions-title" className="sr-only">
        Start here
      </h2>
      <ul className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
        {home.quickActions.map((action) => {
          const Icon = icons[action.icon];
          return (
            <li key={action.href}>
              <Link
                href={action.href}
                className="group pressable flex h-full min-h-28 flex-col justify-between gap-4 rounded-tile bg-surface p-3.5 ring-1 ring-line ring-inset hover:bg-surface-2 sm:p-5 lg:min-h-36 lg:rounded-card lg:p-6"
              >
                <span className="flex items-start justify-between">
                  <span className="grid size-10 place-items-center rounded-full bg-accent text-on-accent lg:size-12">
                    <Icon aria-hidden className="size-5 lg:size-6" />
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="hidden size-5 text-muted transition-transform duration-200 ease-out-soft group-hover:translate-x-1 motion-reduce:transition-none sm:block"
                  />
                </span>
                <span>
                  <span className="block font-display text-base leading-tight font-bold text-balance sm:text-h3 lg:text-[1.5rem]">
                    {action.title}
                  </span>
                  <span className="mt-1 hidden text-small text-pretty text-muted sm:block">{action.body}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

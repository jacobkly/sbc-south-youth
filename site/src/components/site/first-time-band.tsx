import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/button";

/**
 * Points first-timers to Visit at the end of a page. A card on phones and
 * desktop, and a band between hairlines from xl up.
 */
export function FirstTimeBand() {
  return (
    <aside className="flex flex-col items-start gap-4 rounded-card bg-surface p-6 ring-1 ring-line ring-inset sm:flex-row sm:items-center sm:justify-between sm:p-8 xl:rounded-none xl:border-y xl:border-line xl:bg-transparent xl:px-0 xl:py-12 xl:ring-0">
      <div>
        <p className="font-display text-h3 font-bold xl:text-h2">First time coming?</p>
        <p className="mt-1 text-small text-muted xl:mt-2 xl:text-body">
          Where to park, what to expect, and who to look for.
        </p>
      </div>
      <ButtonLink href="/visit" variant="secondary">
        Plan a visit
        <ArrowRight aria-hidden />
      </ButtonLink>
    </aside>
  );
}

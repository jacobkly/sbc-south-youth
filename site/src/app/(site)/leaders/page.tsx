import type { Metadata } from "next";
import { LeaderCard } from "@/components/site/leader-card";
import { LinkTile } from "@/components/site/link-tile";
import { PageIntro } from "@/components/site/page-intro";
import { leaders } from "@/content/leaders";
import { pages } from "@/content/pages";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata(pages.leaders);

export default function LeadersPage() {
  return (
    <>
      <PageIntro eyebrow={pages.leaders.eyebrow} title={pages.leaders.heading}>
        The people who lead youth nights and would love to meet you. Come say hi, or send them an email.
      </PageIntro>

      <section aria-label="Our leaders" className="page-x">
        <ul className="grid max-w-5xl gap-4 md:grid-cols-2 lg:gap-6">
          {leaders.map((leader) => (
            <li key={leader.slug}>
              <LeaderCard leader={leader} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="leaders-more-title" className="page-x mt-16 lg:mt-24">
        <h2 id="leaders-more-title" className="sr-only">
          Keep exploring
        </h2>
        <div className="grid max-w-5xl gap-4 md:grid-cols-2 lg:gap-6">
          <LinkTile href="/parents" eyebrow="For parents" title="How we look after students">
            Who leads, drop-off, and how we stay in touch.
          </LinkTile>
          <LinkTile href="/connect#serve" eyebrow="Want to help?" title="Find a place to serve" tone="accent">
            Worship, the cafe, and more, for regulars.
          </LinkTile>
        </div>
      </section>
    </>
  );
}

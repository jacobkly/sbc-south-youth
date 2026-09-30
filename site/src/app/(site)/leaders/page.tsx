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
      <PageIntro title={pages.leaders.heading}>
        The people who lead youth nights and would love to meet you. Come say hi, or send them an email.
      </PageIntro>

      {/*
       * From xl up the leaders take 8 columns and the links ride along in
       * the other 4. The cards share the row however many leaders there are.
       */}
      <div className="page-x xl:grid xl:grid-cols-12 xl:items-start xl:gap-x-(--grid-gap)">
        <section aria-label="Our leaders" className="xl:col-span-8">
          <ul className="grid max-w-5xl gap-4 md:grid-cols-2 lg:gap-6 xl:max-w-none xl:grid-cols-[repeat(auto-fit,minmax(22rem,1fr))] xl:gap-(--grid-gap)">
            {leaders.map((leader) => (
              <li key={leader.slug}>
                <LeaderCard leader={leader} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="leaders-more-title" className="mt-16 lg:mt-24 xl:sticky xl:top-24 xl:col-span-4 xl:mt-0">
          <h2 id="leaders-more-title" className="sr-only">
            Keep exploring
          </h2>
          <div className="grid max-w-5xl gap-4 md:grid-cols-2 lg:gap-6 xl:grid-cols-1 xl:gap-(--grid-gap)">
            <LinkTile href="/parents" title="How we look after students">
              Who leads, drop-off, and how we stay in touch.
            </LinkTile>
            <LinkTile href="/connect#serve" title="Find a place to serve" tone="accent">
              Worship, the cafe, and more, for regulars.
            </LinkTile>
          </div>
        </section>
      </div>
    </>
  );
}

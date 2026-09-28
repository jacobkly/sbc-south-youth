import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LeaderCard } from "@/components/site/leader-card";
import { LinkTile } from "@/components/site/link-tile";
import { PageIntro } from "@/components/site/page-intro";
import { leaders } from "@/content/leaders";
import { safety } from "@/content/safety";

export const metadata: Metadata = {
  title: "Leaders",
  description: "Meet the people who lead youth nights, and how to reach them.",
};

export default function LeadersPage() {
  const { screeningLine } = safety;

  return (
    <>
      <PageIntro eyebrow="Leaders" title="Meet the team.">
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

        {screeningLine.confirmed && (
          <p className="mt-6 flex max-w-5xl items-start gap-3 text-pretty text-muted">
            <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-accent-ink" />
            <span>
              {screeningLine.text}{" "}
              <Link href="/parents" className="font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-accent-ink">
                How we keep students safe
              </Link>
            </span>
          </p>
        )}
      </section>

      <section aria-labelledby="leaders-more-title" className="page-x mt-16 lg:mt-24">
        <h2 id="leaders-more-title" className="sr-only">
          Keep exploring
        </h2>
        <div className="grid max-w-5xl gap-4 md:grid-cols-2 lg:gap-6">
          <LinkTile href="/parents" eyebrow="For parents" title="How we look after students">
            Screening, drop-off, and how leaders stay in touch.
          </LinkTile>
          <LinkTile href="/connect#serve" eyebrow="Want to help?" title="Serve on a team" tone="accent">
            Find a spot on the team that fits you.
          </LinkTile>
        </div>
      </section>
    </>
  );
}

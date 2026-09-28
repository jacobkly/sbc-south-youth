import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/button";
import { PageIntro } from "@/components/site/page-intro";
import { Stub } from "@/components/site/stub";
import { site } from "@/content/site";

// Production shows /coming-soon here until launch (see src/lib/launch-gate.ts).
export default function HomePage() {
  return (
    <>
      <PageIntro eyebrow={site.name} title="Show up as you are.">
        <p>{site.tagline}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/visit" size="lg">
            Plan a visit <ArrowRight aria-hidden />
          </ButtonLink>
          <ButtonLink href="/this-week" size="lg" variant="secondary">
            This week
          </ButtonLink>
        </div>
      </PageIntro>
      <Stub note="The hero, Next Up card, and highlights go here." />
    </>
  );
}

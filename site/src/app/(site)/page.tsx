import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/button";
import { InlineScript } from "@/components/inline-script";
import { BentoGrid } from "@/components/site/bento-grid";
import { FeedGuard } from "@/components/site/feed-guard";
import { HeroMedia } from "@/components/site/hero-media";
import { NextUpCard } from "@/components/site/next-up-card";
import { QuickActions } from "@/components/site/quick-actions";
import { RevealScript } from "@/components/site/reveal";
import { home } from "@/content/home";
import { site } from "@/content/site";
import { FEED_ID, inlineCall, refreshFeed } from "@/lib/feed-dom";

// The title, description, and link preview come from the root layout.
export const metadata: Metadata = { alternates: { canonical: "/" } };

// Production shows /coming-soon here until launch (see src/lib/launch-gate.ts).
export default function HomePage() {
  return (
    // The feed root, so Next Up and the highlights drop what's over and keep "Tonight" current.
    <div id={FEED_ID} className="pb-16 lg:pb-24">
      <Hero />
      <QuickActions />
      <div className="mt-14 lg:mt-20">
        <BentoGrid />
      </div>
      <RevealScript />
      <InlineScript html={inlineCall(refreshFeed)} />
      <FeedGuard />
    </div>
  );
}

/**
 * A night-service poster in both themes: full-bleed on phones, with the
 * photo up top fading into black, and a rounded card on desktop, with the
 * photo behind everything. The scrims keep white text at AA or better.
 */
function Hero() {
  const photoHeight = "h-[min(30rem,62svh)] lg:h-auto";

  return (
    <section data-theme="dark" aria-labelledby="home-title" className="lg:page-x lg:pt-4">
      <div className="relative isolate overflow-hidden bg-bg text-fg lg:flex lg:min-h-[min(44rem,calc(100svh-7rem))] lg:items-end lg:rounded-card">
        <HeroMedia
          photo={home.hero.photo}
          focus={home.hero.focus}
          className={`absolute inset-x-0 top-0 -z-10 lg:inset-0 ${photoHeight}`}
        />
        {/* Phones: clear at the top, then solid black where the text starts. */}
        <div
          aria-hidden
          className={`absolute inset-x-0 top-0 -z-10 bg-linear-to-b from-bg/20 via-bg/80 via-50% to-bg lg:hidden ${photoHeight}`}
        />
        {/* Desktop: dark behind the headline and Next Up, the photo clear up top. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 hidden bg-linear-to-t from-bg/90 via-bg/45 via-45% to-bg/5 lg:block"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 hidden bg-linear-to-r from-bg/75 via-bg/25 via-55% to-transparent lg:block"
        />
        {/* Faded out on phones, so it doesn't end in a hard line where the page starts. */}
        <div
          aria-hidden
          className="grain pointer-events-none absolute inset-0 -z-10 opacity-[0.05] mask-b-from-40% mask-b-to-90% lg:mask-none"
        />

        <div className="grid w-full gap-10 px-5 pt-[min(15rem,34svh)] pb-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end lg:gap-12 lg:p-12 xl:grid-cols-[minmax(0,1fr)_24rem] xl:p-14">
          <div className="animate-rise motion-reduce:animate-none">
            <p className="text-eyebrow text-accent-ink uppercase">{site.campus}</p>
            <h1 id="home-title" className="mt-3 max-w-[11ch] font-display text-display text-balance">
              {home.hero.title}
            </h1>
            <p className="mt-5 max-w-md text-pretty text-fg/85 lg:text-lg">{home.hero.lede}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href="/visit" size="lg">
                Plan a visit <ArrowRight aria-hidden />
              </ButtonLink>
              <ButtonLink href="/this-week" size="lg" variant="light">
                This week
              </ButtonLink>
            </div>
          </div>
          <div className="animate-rise [animation-delay:120ms] motion-reduce:animate-none sm:max-w-md lg:max-w-none">
            <NextUpCard />
          </div>
        </div>
      </div>
    </section>
  );
}

import { ArrowRight, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ButtonLink, buttonClasses } from "@/components/button";
import { DirectionsButton } from "@/components/site/directions-button";
import { FaqAccordion } from "@/components/site/faq-accordion";
import { GatheringCard } from "@/components/site/gathering-card";
import { MapArt } from "@/components/site/map-art";
import { PageIntro } from "@/components/site/page-intro";
import { SectionHeader } from "@/components/site/section-header";
import { visitFaq } from "@/content/faq";
import { formatAddress, site } from "@/content/site";
import { visit } from "@/content/visit";
import { getSchedule } from "@/lib/content/loaders";
import { readServerEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Plan a Visit",
  description: "When and where youth meets, where to park, and what to expect on your first night.",
};

const sections = [
  { id: "when", label: "When" },
  { id: "where", label: "Where" },
  { id: "first-night", label: "First night" },
  { id: "faq", label: "FAQ" },
];

const TEXT_BODY = "Hi! I'm planning to come to youth this week.";

export default async function VisitPage() {
  const schedule = await getSchedule();
  const { textNumber } = readServerEnv();
  const address = formatAddress();
  const { parking, firstNight } = visit;

  return (
    <>
      {/* TODO(leadership): confirm "no sign-up needed" and that someone greets visitors at the door. */}
      <PageIntro eyebrow="Plan a visit" title="Your first night, sorted.">
        When and where we meet, where to park, and what to expect when you walk in. No sign-up needed. Just show up.
      </PageIntro>

      <nav aria-label="On this page" className="page-x">
        <ul className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0">
          {sections.map((section) => (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                className="pressable inline-flex h-11 items-center rounded-full bg-surface px-4 text-[0.9375rem] font-medium ring-1 ring-line ring-inset hover:bg-surface-2"
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <section id="when" aria-labelledby="when-title" className="page-x mt-12 scroll-mt-24 lg:mt-16">
        <SectionHeader id="when-title" eyebrow="When" title="Every week">
          Holidays and special nights can change things, so check{" "}
          <Link href="/this-week" className="font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-accent-ink">
            This Week
          </Link>{" "}
          before you come.
        </SectionHeader>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:gap-6">
          {schedule.map((gathering) => (
            <GatheringCard key={gathering.slug} gathering={gathering} />
          ))}
        </div>
      </section>

      <section id="where" aria-labelledby="where-title" className="page-x mt-16 scroll-mt-24 lg:mt-24">
        <SectionHeader id="where-title" eyebrow="Where" title="Finding us" />
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:gap-6">
          <div className="overflow-hidden rounded-card bg-surface ring-1 ring-line ring-inset">
            <div className="relative aspect-[4/3] sm:aspect-[16/10]">
              <MapArt label={site.church.name} />
            </div>
            <div className="p-5">
              <h3 className="text-h3">{site.church.name}</h3>
              <address className="mt-1 text-muted not-italic">
                {site.address.street}
                <br />
                {site.address.city}, {site.address.region} {site.address.postalCode}
              </address>
              <DirectionsButton address={address} className="mt-5 w-full sm:w-auto" />
            </div>
          </div>

          <div className="overflow-hidden rounded-card bg-surface ring-1 ring-line ring-inset">
            <div className="relative aspect-[4/3] sm:aspect-[16/10]">
              <Image
                src={parking.entrancePhoto.src}
                alt={parking.entrancePhoto.alt}
                fill
                sizes="(min-width: 1240px) 600px, (min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="p-5">
              <h3 className="text-h3">Parking and the way in</h3>
              <ul className="mt-3 space-y-2.5">
                {parking.notes.map((note) => (
                  <li key={note} className="flex gap-3 text-pretty text-muted">
                    <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent-ink" />
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="first-night" aria-labelledby="first-night-title" className="page-x mt-16 scroll-mt-24 lg:mt-24">
        <SectionHeader id="first-night-title" eyebrow="Your first night" title="What happens when you walk in" />
        <ol className="mt-8 grid gap-x-6 lg:grid-cols-4">
          {firstNight.map((step, index) => (
            <li
              key={step.title}
              className="relative flex gap-5 pb-8 last:pb-0 lg:flex-col lg:gap-4 lg:border-t lg:border-line lg:pt-6 lg:pb-0"
            >
              {/* The line that joins the numbers on phones. */}
              {index < firstNight.length - 1 && (
                <span aria-hidden className="absolute top-12 bottom-1 left-[1.375rem] w-px bg-line-strong lg:hidden" />
              )}
              <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-accent font-display text-[1.0625rem] font-extrabold text-on-accent">
                {index + 1}
              </span>
              <div className="pt-2 lg:pt-0">
                <h3 className="text-h3">{step.title}</h3>
                <p className="mt-1 text-pretty text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="faq" aria-labelledby="faq-title" className="page-x mt-16 scroll-mt-24 lg:mt-24">
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr] lg:gap-12">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <SectionHeader id="faq-title" eyebrow="Questions" title="Good to know">
              Anything else?{" "}
              <Link href="/contact" className="font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-accent-ink">
                Ask us
              </Link>
              .
            </SectionHeader>
          </div>
          <FaqAccordion items={visitFaq} name="visit-faq" />
        </div>
      </section>

      <section aria-labelledby="coming-title" className="page-x mt-16 lg:mt-24">
        <div className="relative isolate overflow-hidden rounded-card bg-accent p-6 text-on-accent sm:p-10 lg:p-14">
          <p
            aria-hidden
            className="absolute -right-4 -bottom-10 -z-10 font-display text-[11rem] leading-none font-extrabold tracking-[-0.05em] opacity-[0.08] select-none lg:text-[16rem]"
          >
            Hi!
          </p>
          <h2 id="coming-title" className="max-w-lg font-display text-h1 text-balance">
            Coming this week?
          </h2>
          <p className="mt-3 max-w-md text-pretty">
            Let us know and we&apos;ll look out for you at the door. Totally optional. You can always just show up.
          </p>
          <div className="mt-6">
            {textNumber ? (
              <a
                href={`sms:${textNumber}?&body=${encodeURIComponent(TEXT_BODY)}`}
                className={buttonClasses({ variant: "inverse", size: "lg" })}
              >
                <MessageCircle aria-hidden />
                Text us
              </a>
            ) : (
              // TODO: the inline Visit form replaces this link once the forms are built.
              <ButtonLink href="/contact?topic=visit" variant="inverse" size="lg">
                Let us know <ArrowRight aria-hidden />
              </ButtonLink>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

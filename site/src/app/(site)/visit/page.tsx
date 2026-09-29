import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { buttonClasses } from "@/components/button";
import { VisitForm } from "@/components/forms/visit-form";
import { DirectionsButton } from "@/components/site/directions-button";
import { FaqAccordion } from "@/components/site/faq-accordion";
import { GatheringCard } from "@/components/site/gathering-card";
import { JumpNav } from "@/components/site/jump-nav";
import { MapArt } from "@/components/site/map-art";
import { PageIntro } from "@/components/site/page-intro";
import { SectionHeader } from "@/components/site/section-header";
import { Steps } from "@/components/site/steps";
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
  { id: "coming", label: "Let us know" },
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

      <JumpNav sections={sections} />

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
        <div className="mt-8">
          <Steps steps={firstNight} />
        </div>
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

      <section id="coming" aria-labelledby="coming-title" className="page-x mt-16 scroll-mt-24 lg:mt-24">
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6">
          <div className="relative isolate overflow-hidden rounded-card bg-accent p-6 text-on-accent sm:p-10 lg:sticky lg:top-24 lg:min-h-[28rem]">
            <p
              aria-hidden
              className="absolute -right-4 -bottom-10 -z-10 font-display text-[11rem] leading-none font-extrabold tracking-[-0.05em] opacity-[0.08] select-none lg:text-[14rem]"
            >
              Hi!
            </p>
            <h2 id="coming-title" className="max-w-lg font-display text-h1 text-balance">
              Coming this week?
            </h2>
            <p className="mt-3 max-w-md text-pretty">
              Let us know and we&apos;ll look out for you at the door. Totally optional. You can always just show up.
            </p>
            {textNumber && (
              <div className="mt-6">
                <p className="text-small font-semibold">Rather text?</p>
                <a
                  href={`sms:${textNumber}?&body=${encodeURIComponent(TEXT_BODY)}`}
                  className={`${buttonClasses({ variant: "inverse", size: "lg" })} mt-2`}
                >
                  <MessageCircle aria-hidden />
                  Text us
                </a>
              </div>
            )}
          </div>
          <div className="rounded-card bg-surface p-5 ring-1 ring-line ring-inset sm:p-8">
            <VisitForm />
          </div>
        </div>
      </section>
    </>
  );
}

import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/button";
import { VisitForm } from "@/components/forms/visit-form";
import { DirectionsButton } from "@/components/site/directions-button";
import { FaqAccordion } from "@/components/site/faq-accordion";
import { GatheringCard } from "@/components/site/gathering-card";
import { JumpNav } from "@/components/site/jump-nav";
import { MapArt } from "@/components/site/map-art";
import { PageIntro } from "@/components/site/page-intro";
import { Photo } from "@/components/site/photo";
import { SectionHeader } from "@/components/site/section-header";
import { Steps } from "@/components/site/steps";
import { visitFaq } from "@/content/faq";
import { pages } from "@/content/pages";
import { formatAddress, site } from "@/content/site";
import { visit } from "@/content/visit";
import { getPhotos, getSchedule } from "@/lib/content/loaders";
import { readServerEnv } from "@/lib/env";
import { pageMetadata } from "@/lib/metadata";
import { photoSizes } from "@/lib/photo-sizes";

export const metadata: Metadata = pageMetadata(pages.visit);

const sections = [
  { id: "when", label: "When" },
  { id: "where", label: "Where" },
  { id: "first-night", label: "First night" },
  { id: "faq", label: "FAQ" },
  { id: "coming", label: "Let us know" },
];

const TEXT_BODY = "Hi! I'm planning to come to youth this week.";

export default async function VisitPage() {
  const [schedule, { spots }] = await Promise.all([getSchedule(), getPhotos()]);
  const { textNumber } = readServerEnv();
  const address = formatAddress();
  const { parking, firstNight, meetALeader } = visit;

  return (
    <>
      <PageIntro title={pages.visit.heading} aside={<JumpNav sections={sections} layout="end" />}>
        When and where we meet, where to park, and what to expect when you walk in. No sign-up needed. Just show up.
      </PageIntro>

      {/* From xl up, the page's header has these links instead. */}
      <JumpNav sections={sections} className="xl:hidden" />

      <section id="when" aria-labelledby="when-title" className="page-x mt-12 scroll-mt-24 lg:mt-16">
        <SectionHeader id="when-title" title="Every Friday">
          Holidays and special nights can change things, so check{" "}
          <Link href="/this-week" className="font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-accent-ink">
            This Week
          </Link>{" "}
          before you come.
        </SectionHeader>
        <div className={`mt-6 grid gap-4 lg:gap-6 ${schedule.length > 1 ? "md:grid-cols-2" : ""}`}>
          {schedule.map((gathering) => (
            <GatheringCard key={gathering.slug} gathering={gathering} wide={schedule.length === 1} />
          ))}
        </div>
      </section>

      <section id="where" aria-labelledby="where-title" className="page-x mt-16 scroll-mt-24 lg:mt-24">
        <SectionHeader id="where-title" title="Where to find us" />
        {/*
         * Two cards on tablets. From xl up the cards open into one row: the
         * map (5 columns), the address over the parking notes (4), and the
         * front door (3).
         */}
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:gap-6 xl:grid-cols-12 xl:gap-x-(--grid-gap) xl:gap-y-0">
          <div className="overflow-hidden rounded-card bg-surface ring-1 ring-line ring-inset xl:contents">
            <div className="relative aspect-[4/3] sm:aspect-[16/10] xl:col-span-5 xl:row-span-2 xl:aspect-auto xl:min-h-[26rem] xl:overflow-hidden xl:rounded-card xl:ring-1 xl:ring-line xl:ring-inset">
              <MapArt label={site.campus} />
            </div>
            <div className="p-5 xl:col-span-4 xl:col-start-6 xl:row-start-1 xl:self-start xl:px-0 xl:pt-0 xl:pb-8">
              <h3 className="text-h3">{site.campus}</h3>
              <address className="mt-1 text-muted not-italic">
                {site.address.street}
                <br />
                {site.address.city}, {site.address.region} {site.address.postalCode}
              </address>
              <DirectionsButton address={address} className="mt-5 w-full sm:w-auto" />
            </div>
          </div>

          <div className="overflow-hidden rounded-card bg-surface ring-1 ring-line ring-inset xl:contents">
            <div className="relative aspect-[4/3] sm:aspect-[16/10] xl:col-span-3 xl:col-start-10 xl:row-span-2 xl:row-start-1 xl:aspect-auto xl:overflow-hidden xl:rounded-card">
              <Photo
                photo={spots.entrance}
                seed="entrance"
                sizes={photoSizes({ xl: 1 / 4, lg: 1 / 2, md: 1 / 2 })}
              />
            </div>
            <div className="p-5 xl:col-span-4 xl:col-start-6 xl:row-start-2 xl:border-t xl:border-line xl:px-0 xl:pt-8 xl:pb-0">
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
        <SectionHeader id="first-night-title" title="What happens when you walk in" />
        <div className="mt-8">
          <Steps steps={firstNight} />
        </div>
        <p className="mt-10 max-w-2xl border-l-2 border-accent-ink pl-4 text-lg text-pretty">{meetALeader}</p>
      </section>

      <section id="faq" aria-labelledby="faq-title" className="page-x mt-16 scroll-mt-24 lg:mt-24">
        <div className="grid gap-6 lg:grid-cols-[minmax(20rem,1fr)_2fr] lg:gap-12 xl:grid-cols-12 xl:gap-x-(--grid-gap)">
          <div className="lg:sticky lg:top-24 lg:self-start xl:col-span-4">
            <SectionHeader id="faq-title" title="Questions">
              Anything else?{" "}
              <Link href="/contact" className="font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-accent-ink">
                Ask us
              </Link>
              .
            </SectionHeader>
          </div>
          <FaqAccordion items={visitFaq} name="visit-faq" className="xl:col-span-8" />
        </div>
      </section>

      <section id="coming" aria-labelledby="coming-title" className="page-x mt-16 scroll-mt-24 lg:mt-24">
        {/* Below lg both cards stop at 42rem. From xl up the form stops at 44rem, and the poster takes the rest. */}
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_44rem] xl:gap-(--grid-gap)">
          <div className="relative isolate overflow-hidden max-w-2xl rounded-card bg-accent p-6 text-on-accent sm:p-10 lg:sticky lg:top-24 lg:min-h-[28rem] lg:max-w-none xl:p-12">
            <p
              aria-hidden
              className="absolute -right-4 -bottom-10 -z-10 font-display text-[11rem] leading-none font-extrabold tracking-[-0.05em] opacity-[0.08] select-none lg:text-[14rem] 2xl:text-[18rem]"
            >
              Hi!
            </p>
            <h2 id="coming-title" className="max-w-lg font-display text-h1 text-balance">
              Coming this week?
            </h2>
            <p className="mt-3 max-w-md text-pretty">
              Let us know and we&apos;ll keep an eye out for you. Totally optional. You can always just show up.
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
          <div className="max-w-2xl rounded-card bg-surface p-5 ring-1 ring-line ring-inset sm:p-8 lg:max-w-none">
            <VisitForm />
          </div>
        </div>
      </section>
    </>
  );
}

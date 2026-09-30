import { ArrowRight, Bell, Camera, Car, FileText, GraduationCap, Mail, MessagesSquare, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink, buttonClasses } from "@/components/button";
import { Avatar } from "@/components/site/avatar";
import { DirectionsButton } from "@/components/site/directions-button";
import { JumpNav } from "@/components/site/jump-nav";
import { PageIntro } from "@/components/site/page-intro";
import { Photo } from "@/components/site/photo";
import { PendingTag, PolicyCard } from "@/components/site/policy-card";
import { SectionHeader } from "@/components/site/section-header";
import { Steps } from "@/components/site/steps";
import { leaders, parentContactSlug } from "@/content/leaders";
import { pages } from "@/content/pages";
import { photos } from "@/content/photos";
import { safety } from "@/content/safety";
import type { PolicyPoint } from "@/content/safety";
import { formatAddress, site } from "@/content/site";
import { visit } from "@/content/visit";
import { getSchedule } from "@/lib/content/loaders";
import { pageMetadata } from "@/lib/metadata";
import { formatClockRange, weekdayName } from "@/lib/schedule";

export const metadata: Metadata = pageMetadata(pages.parents);

const sections = [
  { id: "commitment", label: "Safety" },
  { id: "typical-night", label: "A typical night" },
  { id: "drop-off", label: "Drop-off" },
  { id: "staying-in-touch", label: "Staying in touch" },
  { id: "photos", label: "Photos" },
  { id: "contact", label: "Contact" },
];

const linkClasses = "font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-accent-ink";

export default async function ParentsPage() {
  const schedule = await getSchedule();
  const { commitment, communication, dropOff } = safety;
  const contact = leaders.find((leader) => leader.slug === parentContactSlug);
  const contactFirstName = contact?.name.trim().split(/\s+/)[0];

  return (
    <>
      <PageIntro eyebrow={pages.parents.eyebrow} title={pages.parents.heading}>
        How we look after students, what a typical night looks like, and how to reach us. If anything here leaves you with a
        question, ask. We&apos;d love to hear from you.
      </PageIntro>

      <JumpNav sections={sections} />

      <section id="commitment" aria-labelledby="commitment-title" className="page-x mt-12 scroll-mt-24 lg:mt-16">
        <SectionHeader id="commitment-title" eyebrow="Our commitment" title="Keeping students safe" />
        <ul className="mt-6 grid gap-4 md:grid-cols-3 lg:gap-6">
          <li>
            <PolicyCard point={commitment.screening} icon={<ShieldCheck />} />
          </li>
          <li>
            <PolicyCard point={commitment.training} icon={<GraduationCap />} />
          </li>
          <li>
            <PolicyCard point={commitment.supervision} icon={<Users />} />
          </li>
        </ul>

        <div className="mt-4 flex flex-col gap-4 rounded-card bg-surface p-5 ring-1 ring-line ring-inset sm:flex-row sm:items-center sm:p-6 lg:mt-6">
          <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-surface-2 ring-1 ring-line ring-inset">
            <FileText className="size-5" />
          </span>
          <div className="flex-1">
            <h3 className="flex flex-wrap items-center gap-x-3 gap-y-2 text-h3">
              Youth protection policy
              {!safety.policyHref && <PendingTag />}
            </h3>
            <p className="mt-1 text-pretty text-muted">
              {safety.policyHref ? "The full policy the church follows, as a PDF." : "The full policy will be posted here once it's ready."}
            </p>
          </div>
          {safety.policyHref && (
            <a href={safety.policyHref} className={buttonClasses({ variant: "secondary", className: "w-full sm:w-auto" })}>
              Download PDF
            </a>
          )}
        </div>
      </section>

      <section id="typical-night" aria-labelledby="typical-night-title" className="page-x mt-16 scroll-mt-24 lg:mt-24">
        <SectionHeader
          id="typical-night-title"
          eyebrow="A typical night"
          title="What your student's night looks like"
          action={
            <Link href="/visit" className={`inline-flex items-center gap-1.5 ${linkClasses}`}>
              Plan a visit <ArrowRight aria-hidden className="size-4" />
            </Link>
          }
        />
        <ul className={`mt-6 grid gap-3 lg:gap-6 ${schedule.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {schedule.map((gathering) => (
            <li key={gathering.slug} className="rounded-tile bg-surface p-4 ring-1 ring-line ring-inset sm:p-5">
              <p className="font-semibold">{gathering.title}</p>
              <p className="mt-1 font-display text-h3 font-bold">
                {weekdayName(gathering.weekday, { plural: true })}, {formatClockRange(gathering.startTime, gathering.endTime)}
              </p>
              <p className="mt-0.5 text-small text-muted">{gathering.locationName ?? site.campus}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10">
          <Steps steps={visit.firstNight} />
        </div>
      </section>

      <section id="drop-off" aria-labelledby="drop-off-title" className="page-x mt-16 scroll-mt-24 lg:mt-24">
        <SectionHeader id="drop-off-title" eyebrow="Drop-off and pick-up" title="Getting there and home" />
        <div className="mt-6 grid overflow-hidden rounded-card bg-surface ring-1 ring-line ring-inset md:grid-cols-2">
          <div className="relative aspect-[4/3] md:aspect-auto md:min-h-80">
            <Photo photo={dropOff.photo} seed="drop-off" sizes="(min-width: 1240px) 600px, (min-width: 768px) 50vw, 100vw" />
          </div>
          <div className="flex flex-col p-5 sm:p-6 lg:p-8">
            <ul className="space-y-3">
              {dropOff.notes.map((note) => (
                <li key={note} className="flex gap-3 text-pretty">
                  <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent-ink" />
                  {note}
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-6">
              <DirectionsButton address={formatAddress()} variant="secondary" className="w-full sm:w-auto" />
            </div>
          </div>
        </div>
      </section>

      <section id="staying-in-touch" aria-labelledby="staying-in-touch-title" className="page-x mt-16 scroll-mt-24 lg:mt-24">
        <SectionHeader id="staying-in-touch-title" eyebrow="Staying in touch" title="How leaders communicate" />
        <ul className="mt-6 divide-y divide-line rounded-card bg-surface ring-1 ring-line ring-inset">
          <PolicyRow point={communication.messaging} icon={<MessagesSquare />} />
          <PolicyRow point={communication.parents} icon={<Bell />} />
          <PolicyRow point={communication.rides} icon={<Car />} />
        </ul>
      </section>

      <section id="photos" aria-labelledby="photos-title" className="page-x mt-16 scroll-mt-24 lg:mt-24">
        <div className="grid overflow-hidden rounded-card bg-surface ring-1 ring-line ring-inset md:grid-cols-[3fr_2fr]">
          <div className="p-5 sm:p-6 lg:p-10">
            <p className="text-eyebrow text-accent-ink uppercase">Photos</p>
            <h2 id="photos-title" className="mt-2 font-display text-h2 text-balance">
              Photos and your student
            </h2>
            <p className="mt-3 max-w-lg text-pretty text-muted">{safety.photos.body}</p>
            <div className="mt-5 flex items-start gap-3 rounded-tile bg-surface-2 p-4">
              <Camera aria-hidden className="mt-0.5 size-5 shrink-0 text-accent-ink" />
              <div>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold">
                  {safety.photos.release.title}
                  {!safety.photos.release.confirmed && <PendingTag />}
                </p>
                <p className="mt-1 text-pretty text-muted">{safety.photos.release.body}</p>
              </div>
            </div>
            <ButtonLink href="/contact?topic=photo-removal" variant="secondary" className="mt-6 w-full sm:w-auto">
              Ask us to remove a photo
            </ButtonLink>
          </div>
          <div className="relative hidden md:block">
            <Photo photo={photos.camera} seed="photos" sizes="(min-width: 1240px) 480px, 40vw" />
          </div>
        </div>
      </section>

      {contact && (
        <section id="contact" aria-labelledby="contact-title" className="page-x mt-16 scroll-mt-24 lg:mt-24">
          <div className="relative isolate overflow-hidden rounded-card bg-accent p-6 text-on-accent sm:p-10 lg:p-14">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
              <Avatar leader={contact} className="size-20 ring-4 ring-on-accent/10 sm:size-24" />
              <div>
                <p className="text-eyebrow uppercase">Questions?</p>
                <h2 id="contact-title" className="mt-2 font-display text-h1 text-balance">
                  Talk to {contactFirstName}
                </h2>
                <p className="mt-2 max-w-md text-pretty">
                  {contact.name} is our {contact.role.toLowerCase()}. Ask about anything: safety, schedules, or how your student is doing.
                </p>
              </div>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              {contact.email && (
                <a href={`mailto:${contact.email}`} className={buttonClasses({ variant: "inverse", size: "lg" })}>
                  <Mail aria-hidden />
                  Email {contactFirstName}
                </a>
              )}
              <Link href="/contact" className="self-center font-semibold underline decoration-on-accent/30 underline-offset-4 hover:decoration-on-accent">
                Or send us a message
              </Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

/** A communication policy as a row: an icon, the title, and what it covers. */
function PolicyRow({ point, icon }: { point: PolicyPoint; icon: ReactNode }) {
  return (
    <li className="flex gap-4 p-5 sm:p-6">
      <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 ring-1 ring-line ring-inset [&_svg]:size-5">
        {icon}
      </span>
      <div className="min-w-0">
        <h3 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-h3">
          {point.title}
          {!point.confirmed && <PendingTag />}
        </h3>
        <p className="mt-1 text-pretty text-muted">{point.body}</p>
      </div>
    </li>
  );
}

import { ArrowRight, Bus, Camera, Church, FileText, Footprints, HeartHandshake, Megaphone, MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink, buttonClasses } from "@/components/button";
import { DirectionsButton } from "@/components/site/directions-button";
import { JumpNav } from "@/components/site/jump-nav";
import { LinkTile } from "@/components/site/link-tile";
import { PageIntro } from "@/components/site/page-intro";
import { Photo } from "@/components/site/photo";
import { PendingTag, PolicyCard } from "@/components/site/policy-card";
import { SectionHeader } from "@/components/site/section-header";
import { Steps } from "@/components/site/steps";
import { pages } from "@/content/pages";
import { safety } from "@/content/safety";
import type { PolicyPoint } from "@/content/safety";
import { formatAddress, site } from "@/content/site";
import { visit } from "@/content/visit";
import { getPhotos, getSchedule } from "@/lib/content/loaders";
import { pageMetadata } from "@/lib/metadata";
import { photoSizes } from "@/lib/photo-sizes";
import { formatClockRange, weekdayName } from "@/lib/schedule";

export const metadata: Metadata = pageMetadata(pages.parents);

const sections = [
  { id: "commitment", label: "Leaders" },
  { id: "typical-night", label: "A typical night" },
  { id: "drop-off", label: "Drop-off" },
  { id: "staying-in-touch", label: "Staying in touch" },
  { id: "photos", label: "Photos" },
  { id: "contact", label: "Contact" },
];

// From xl up each section is a 9-column grid: text in 6, then a photo or link in 3.
// Where a photo spans two rows, `grid-rows-[auto_1fr]` keeps the heading row tight.
const sectionClasses = "scroll-mt-24 xl:grid xl:grid-cols-9 xl:gap-x-(--grid-gap)";
const textColumn = "xl:col-span-6";
const sideColumn = "hidden xl:col-span-3 xl:block xl:self-start";

const linkClasses = "font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-accent-ink";

export default async function ParentsPage() {
  const [schedule, { spots }] = await Promise.all([getSchedule(), getPhotos()]);
  const { commitment, communication, dropOff } = safety;
  const instagram = site.socials.find((social) => social.kind === "instagram");

  return (
    <>
      <PageIntro title={pages.parents.heading}>
        How we look after students, what a typical night looks like, and how to reach us. If anything here leaves you with a
        question, ask. We&apos;d love to hear from you.
      </PageIntro>

      {/* From xl up the index down the side takes over. */}
      <JumpNav sections={sections} className="xl:hidden" />

      {/*
       * From xl up the page reads like a document: the index sticks in the
       * first 3 columns, the text takes the next 6, and photos and links sit
       * in the last 3. Each section is its own 9-column grid.
       */}
      <div className="page-x xl:grid xl:grid-cols-12 xl:gap-x-(--grid-gap)">
        <div className="hidden xl:col-span-3 xl:block">
          <JumpNav sections={sections} layout="index" className="sticky top-24" />
        </div>

        <div className="xl:col-span-9">
          <section id="commitment" aria-labelledby="commitment-title" className={`mt-12 lg:mt-16 xl:mt-0 ${sectionClasses}`}>
            <div className={textColumn}>
              <SectionHeader id="commitment-title" title="Who looks after students" />
              <ul className="mt-6 grid gap-4 md:grid-cols-3 lg:gap-6 xl:grid-cols-1 xl:gap-0 xl:divide-y xl:divide-line xl:border-y xl:border-line">
                <li>
                  <PolicyCard point={commitment.leaders} icon={<Church />} />
                </li>
                <li>
                  <PolicyCard point={commitment.learning} icon={<Footprints />} />
                </li>
                <li>
                  <PolicyCard point={commitment.accountability} icon={<HeartHandshake />} />
                </li>
              </ul>

              {/* Only once the church has a written policy to share. */}
              {safety.policyHref && (
                <div className="mt-4 flex flex-col gap-4 rounded-card bg-surface p-5 ring-1 ring-line ring-inset sm:flex-row sm:items-center sm:p-6 lg:mt-6">
                  <span
                    aria-hidden
                    className="grid size-12 shrink-0 place-items-center rounded-full bg-surface-2 ring-1 ring-line ring-inset"
                  >
                    <FileText className="size-5" />
                  </span>
                  <div className="flex-1">
                    <h3 className="text-h3">Youth protection policy</h3>
                    <p className="mt-1 text-pretty text-muted">The full policy the church follows, as a PDF.</p>
                  </div>
                  <a
                    href={safety.policyHref}
                    className={buttonClasses({
                      variant: "secondary",
                      className: "w-full sm:w-auto",
                    })}
                  >
                    Download PDF
                  </a>
                </div>
              )}
            </div>
            <div className={sideColumn}>
              <LinkTile href="/leaders" title="Meet the leaders">
                Who they are and how to reach them.
              </LinkTile>
            </div>
          </section>

          <section
            id="typical-night"
            aria-labelledby="typical-night-title"
            className={`mt-16 lg:mt-24 xl:grid-rows-[auto_1fr] ${sectionClasses}`}
          >
            <div className={textColumn}>
              <SectionHeader
                id="typical-night-title"
                title="A typical Friday"
                action={
                  <Link href="/visit" className={`inline-flex items-center gap-1.5 ${linkClasses}`}>
                    Plan a visit <ArrowRight aria-hidden className="size-4" />
                  </Link>
                }
              />
            </div>
            {/* From xl up the times sit beside the steps. */}
            <ul
              className={`mt-6 grid gap-3 lg:gap-6 xl:col-span-3 xl:col-start-7 xl:row-span-2 xl:row-start-1 xl:mt-0 xl:grid-cols-1 xl:gap-4 xl:self-start ${schedule.length > 1 ? "sm:grid-cols-2" : ""}`}
            >
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
            <div className="mt-10 xl:col-span-6 xl:col-start-1 xl:row-start-2">
              <Steps steps={visit.firstNight} className="xl:grid-cols-2 xl:gap-y-10" />
            </div>
          </section>

          <section
            id="drop-off"
            aria-labelledby="drop-off-title"
            className={`mt-16 lg:mt-24 xl:grid-rows-[auto_1fr] ${sectionClasses}`}
          >
            <div className={textColumn}>
              <SectionHeader id="drop-off-title" title="Drop-off and pick-up" />
            </div>
            {/* From xl up the card opens: the notes under the heading and the photo beside them. */}
            <div className="mt-6 grid overflow-hidden rounded-card bg-surface ring-1 ring-line ring-inset md:grid-cols-2 xl:contents">
              <div className="relative aspect-[4/3] md:aspect-auto md:min-h-80 xl:col-span-3 xl:col-start-7 xl:row-span-2 xl:row-start-1 xl:aspect-[4/5] xl:min-h-0 xl:self-start xl:overflow-hidden xl:rounded-card">
                <Photo photo={spots.entrance} seed="drop-off" sizes={photoSizes({ xl: 1 / 4, lg: 1 / 2, md: 1 / 2 })} />
              </div>
              <div className="flex flex-col p-5 sm:p-6 lg:p-8 xl:col-span-6 xl:col-start-1 xl:row-start-2 xl:mt-6 xl:self-start xl:p-0">
                <ul className="max-w-[36em] space-y-3">
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

          <section id="staying-in-touch" aria-labelledby="staying-in-touch-title" className={`mt-16 lg:mt-24 ${sectionClasses}`}>
            <div className={textColumn}>
              <SectionHeader id="staying-in-touch-title" title="Staying in touch" />
              <ul className="mt-6 divide-y divide-line rounded-card bg-surface ring-1 ring-line ring-inset xl:rounded-none xl:border-y xl:border-line xl:bg-transparent xl:ring-0">
                <PolicyRow point={communication.chat} icon={<MessagesSquare />} />
                <PolicyRow point={communication.trips} icon={<Bus />} />
                <PolicyRow point={communication.events} icon={<Megaphone />} />
              </ul>
            </div>
            {instagram && (
              <div className={sideColumn}>
                <LinkTile href={instagram.href} title="Follow on Instagram">
                  Where we post big events.
                </LinkTile>
              </div>
            )}
          </section>

          <section id="photos" aria-labelledby="photos-title" className="mt-16 scroll-mt-24 lg:mt-24">
            {/* From xl up the card opens into the text and a photo beside it. */}
            <div className="grid overflow-hidden rounded-card bg-surface ring-1 ring-line ring-inset md:grid-cols-[3fr_2fr] xl:grid-cols-9 xl:gap-x-(--grid-gap) xl:overflow-visible xl:rounded-none xl:bg-transparent xl:ring-0">
              <div className="p-5 sm:p-6 lg:p-10 xl:col-span-6 xl:p-0">
                <h2 id="photos-title" className="font-display text-h2 text-balance">
                  Photos and your student
                </h2>
                <p className="mt-3 max-w-lg text-pretty text-muted">{safety.photos.body}</p>
                <p className="mt-5 flex max-w-lg items-start gap-3 rounded-tile bg-surface-2 p-4 font-medium text-pretty">
                  <Camera aria-hidden className="mt-0.5 size-5 shrink-0 text-accent-ink" />
                  {safety.photos.removal}
                </p>
                <ButtonLink href="/contact?topic=photo-removal" variant="secondary" className="mt-6 w-full sm:w-auto">
                  Ask us to remove a photo
                </ButtonLink>
              </div>
              <div className="relative hidden md:block xl:col-span-3 xl:aspect-[4/5] xl:self-start xl:overflow-hidden xl:rounded-card">
                <Photo
                  photo={spots["parents-photos"]}
                  seed="photos"
                  sizes={photoSizes({ xl: 1 / 4, lg: 2 / 5, md: 2 / 5 })}
                />
              </div>
            </div>
          </section>

          <section id="contact" aria-labelledby="contact-title" className="mt-16 scroll-mt-24 lg:mt-24">
            <div className="relative isolate overflow-hidden rounded-card bg-accent p-6 text-on-accent sm:p-10 lg:p-14">
              <h2 id="contact-title" className="font-display text-h1 text-balance">
                Questions?
              </h2>
              <p className="mt-2 max-w-md text-pretty">
                Ask any youth leader at church, or send a message. It could be about a trip, the schedule, or how your student is
                doing.
              </p>
              <ButtonLink href="/contact?topic=parent" variant="inverse" size="lg" className="mt-8 w-full sm:w-auto">
                Send a message
              </ButtonLink>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

/** A communication policy as a row: an icon, the title, and what it covers. */
function PolicyRow({ point, icon }: { point: PolicyPoint; icon: ReactNode }) {
  return (
    <li className="flex gap-4 p-5 sm:p-6 xl:px-0">
      <span
        aria-hidden
        className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 ring-1 ring-line ring-inset [&_svg]:size-5"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <h3 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-h3">
          {point.title}
          {!point.confirmed && <PendingTag />}
        </h3>
        <p className="mt-1 max-w-[36em] text-pretty text-muted">{point.body}</p>
      </div>
    </li>
  );
}

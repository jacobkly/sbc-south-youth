import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CalendarDays,
  CalendarOff,
  CalendarPlus,
  Clock,
  History,
  MapPin,
  Repeat,
  Star,
  Ticket,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink, buttonClasses } from "@/components/button";
import { Tag } from "@/components/tag";
import { addDays } from "@/lib/dates";
import type { EventView } from "@/lib/event-view";
import { photoSizes } from "@/lib/photo-sizes";
import { DateBlock } from "./date-block";
import { DirectionsButton } from "./directions-button";
import { Photo } from "./photo";
import { ShareButton } from "./share-button";

/**
 * An event page under the top bar: the poster, then the details beside
 * the story on desktop. Needs the feed root around it, which hides the
 * calendar buttons once the event ends.
 */
export function EventPageBody({ view }: { view: EventView }) {
  return (
    <>
      <Hero view={view} />

      {/* The story beside the details on desktop, 7 columns to 5 from xl up. */}
      <div className="page-x mt-8 grid gap-12 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16 xl:grid-cols-12 xl:gap-x-(--grid-gap)">
        <DetailsCard view={view} />
        <div className="flex min-w-0 flex-col gap-12 lg:col-start-1 lg:row-start-1 lg:gap-16 xl:col-span-7">
          {view.description && <About text={view.description} />}
          {view.weekly && <NextNights view={view} />}
        </div>
      </div>
    </>
  );
}

/** The photo as a poster, with the title and when over it. */
function Hero({ view }: { view: EventView }) {
  const where = view.locationName ?? view.address;

  return (
    <div className="lg:page-x lg:pt-6">
      <header data-theme="dark" className="relative isolate overflow-hidden bg-black text-white lg:rounded-card">
        <Photo
          photo={view.photo}
          seed={view.slug}
          sizes={photoSizes({ lg: 1 })}
          eager
          className="-z-10"
        />
        <div className="absolute inset-0 -z-10 bg-linear-to-t from-black/95 via-black/55 to-black/25" />
        {/* On desktop, up to 70% of the screen, and never wider than 16:9. */}
        <div className="flex min-h-[max(26rem,min(34rem,72svh))] flex-col px-5 pt-4 pb-8 lg:min-h-[max(32rem,min(70svh,50vw))] lg:px-12 lg:pt-8 lg:pb-12">
          <ButtonLink href="/this-week" variant="light" size="sm" className="self-start">
            <ArrowLeft aria-hidden />
            This week
          </ButtonLink>
          <div className="mt-auto pt-16">
            <div className="flex flex-wrap gap-1.5">
              {view.cancelled && (
                <Tag tone="accent">
                  <Ban aria-hidden className="mr-1 size-3" />
                  Cancelled
                </Tag>
              )}
              {view.featured && !view.cancelled && (
                <Tag tone="solid">
                  <Star aria-hidden className="mr-1 size-3 fill-current" />
                  Featured
                </Tag>
              )}
              {view.weekly && (
                <Tag tone="glass">
                  <Repeat aria-hidden className="mr-1 size-3" />
                  Weekly
                </Tag>
              )}
            </div>
            <h1 className="mt-4 max-w-4xl font-display text-display text-balance">{view.title}</h1>
            <p
              className={`mt-4 font-display text-h3 font-bold ${
                view.cancelled ? "text-white/60 line-through decoration-accent decoration-[0.1em]" : "text-accent"
              }`}
            >
              {view.date}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-white/80">
              <p className="flex items-center gap-1.5">
                <Clock aria-hidden className="size-4 shrink-0" />
                {view.time}
              </p>
              {where && (
                <p className="flex min-w-0 items-center gap-1.5">
                  <MapPin aria-hidden className="size-4 shrink-0" />
                  {where}
                </p>
              )}
            </div>
            {view.cancelled && <CancelledBanner reason={view.cancelled.reason} />}
          </div>
        </div>
      </header>
    </div>
  );
}

/** Why it's off, over the poster, so it's the first thing anyone sees. */
function CancelledBanner({ reason }: { reason?: string }) {
  return (
    <div className="mt-6 max-w-xl rounded-card bg-black/45 p-4 ring-1 ring-white/25 ring-inset backdrop-blur-md sm:p-5">
      <p className="flex items-center gap-2 font-semibold">
        <Ban aria-hidden className="size-4.5 shrink-0 text-accent" />
        This one&apos;s cancelled.
      </p>
      {reason && <p className="mt-1 whitespace-pre-line text-white/80">{reason}</p>}
    </div>
  );
}

/**
 * The facts and the calendar buttons. On phones it comes right after the
 * poster; on desktop it rides along beside the description. When the
 * column is wide, the facts pair up and the buttons share a row.
 */
function DetailsCard({ view }: { view: EventView }) {
  return (
    <aside
      aria-label="Details"
      data-scope
      className="@container min-w-0 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:self-start xl:col-span-5 xl:col-start-8"
    >
      <div className="rounded-card bg-surface p-5 ring-1 ring-line ring-inset sm:p-6">
        <dl className="flex flex-col gap-5 @lg:grid @lg:grid-cols-2 @lg:gap-x-6 @4xl:grid-cols-3">
          <Detail icon={<CalendarDays />} term="When">
            <p className="font-semibold">{view.date}</p>
            <p className="text-muted">{view.time}</p>
          </Detail>
          {(view.locationName || view.address) && (
            <Detail icon={<MapPin />} term="Where">
              {view.locationName && <p className="font-semibold">{view.locationName}</p>}
              {view.address && (
                <>
                  <p className="text-muted">{view.address}</p>
                  <DirectionsButton address={view.address} variant="secondary" size="sm" className="mt-3" />
                </>
              )}
            </Detail>
          )}
          {view.costNote && (
            <Detail icon={<Ticket />} term="Cost">
              <p className="font-semibold">{view.costNote}</p>
            </Detail>
          )}
        </dl>

        {view.cancelled ? (
          <div className="mt-6 border-t border-line pt-6">
            <p className="flex items-center gap-2 font-semibold">
              <CalendarOff aria-hidden className="size-4.5 text-accent-ink" />
              It&apos;s off the calendar.
            </p>
            <p className="mt-1 text-small text-muted">
              If you added it to yours, you can delete it. Here&apos;s what&apos;s still on.
            </p>
            <ButtonLink href="/this-week" className="mt-4 w-full">
              See this week
              <ArrowRight aria-hidden />
            </ButtonLink>
          </div>
        ) : (
          <>
            <div
              data-item
              data-until={view.endsAt ?? undefined}
              hidden={view.ended || undefined}
              suppressHydrationWarning
              className="mt-6 flex flex-col gap-2 border-t border-line pt-6 @xl:grid @xl:grid-cols-3"
            >
              <a href={`/events/${view.slug}/calendar.ics`} className={buttonClasses({ className: "w-full" })}>
                <CalendarPlus aria-hidden />
                {view.weekly ? "Add every week" : "Add to calendar"}
              </a>
              <a href={view.googleCalendar} className={buttonClasses({ variant: "secondary", className: "w-full" })}>
                Google Calendar
              </a>
              <ShareButton title={view.title} path={`/events/${view.slug}`} variant="ghost" className="w-full" />
            </div>

            <div
              data-empty
              hidden={!view.ended}
              suppressHydrationWarning
              className="mt-6 border-t border-line pt-6"
            >
              <p className="flex items-center gap-2 font-semibold">
                <History aria-hidden className="size-4.5 text-accent-ink" />
                This one already happened.
              </p>
              <p className="mt-1 text-small text-muted">Thanks to everyone who came. Here&apos;s what&apos;s next.</p>
              <ButtonLink href="/this-week" className="mt-4 w-full">
                See this week
                <ArrowRight aria-hidden />
              </ButtonLink>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function Detail({ icon, term, children }: { icon: ReactNode; term: string; children: ReactNode }) {
  return (
    <div className="relative min-h-10 pl-13">
      <dt className="text-eyebrow text-muted uppercase">
        <span
          aria-hidden
          className="absolute top-0 left-0 grid size-10 place-items-center rounded-full bg-surface-2 text-accent-ink ring-1 ring-line ring-inset [&_svg]:size-4.5"
        >
          {icon}
        </span>
        {term}
      </dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

/** The description, a paragraph for each blank-line break. */
function About({ text }: { text: string }) {
  return (
    <section aria-labelledby="about-title">
      <h2 id="about-title" className="text-eyebrow text-accent-ink uppercase">
        About
      </h2>
      {/* 30em is about 65 characters. The font's wide digits make ch run long. */}
      <div className="mt-4 flex max-w-[30em] flex-col gap-4 text-lg leading-relaxed text-pretty sm:text-xl sm:leading-relaxed 2xl:text-2xl 2xl:leading-relaxed">
        {text.split(/\n{2,}/).map((paragraph, index) => (
          <p key={index} className="whitespace-pre-line">
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}

/**
 * The next few dates of a weekly night. Nights that end while the page
 * is open drop off, and the spare slides in.
 */
function NextNights({ view }: { view: EventView }) {
  const tomorrow = addDays(view.today, 1);

  return (
    <section aria-labelledby="nights-title" data-scope>
      <h2 id="nights-title" className="text-eyebrow text-accent-ink uppercase">
        Next nights
      </h2>
      <ol className="mt-4 grid max-w-md grid-cols-4 gap-3 sm:gap-4">
        {view.nights.map((night) => (
          <li
            key={night.key}
            data-item
            data-until={Date.parse(night.endsAt)}
            data-date={night.date}
            data-rel={night.date === view.today ? "today" : night.date === tomorrow ? "tomorrow" : ""}
            suppressHydrationWarning
            // Only the first four still coming show.
            className="group/day [li:not([hidden])~li:not([hidden])~li:not([hidden])~li:not([hidden])~&]:hidden"
          >
            <DateBlock date={night.date} />
          </li>
        ))}
      </ol>
      <div
        data-empty
        hidden={view.nights.length > 0}
        suppressHydrationWarning
        className="mt-4 text-small text-muted"
      >
        Check This Week for the next nights.
      </div>
      <p className="mt-5 max-w-md text-small text-pretty text-muted">
        Holidays and special nights can change things, so check{" "}
        <Link
          href="/this-week"
          className="font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-accent-ink"
        >
          This Week
        </Link>{" "}
        before you come.
      </p>
    </section>
  );
}

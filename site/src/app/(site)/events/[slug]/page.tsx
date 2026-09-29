import { ArrowLeft, ArrowRight, CalendarDays, CalendarPlus, Clock, History, MapPin, Repeat, Star, Ticket, Users } from "lucide-react";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ButtonLink, buttonClasses } from "@/components/button";
import { InlineScript } from "@/components/inline-script";
import { DateBlock } from "@/components/site/date-block";
import { DirectionsButton } from "@/components/site/directions-button";
import { FeedGuard } from "@/components/site/feed-guard";
import { Photo } from "@/components/site/photo";
import { ShareButton } from "@/components/site/share-button";
import { AudienceTag, Tag } from "@/components/tag";
import { formatAddress, site } from "@/content/site";
import { getBySlug, getEventSlugs } from "@/lib/content/loaders";
import type { Audience, Photo as PhotoData } from "@/lib/content/types";
import { addDays, todayInLA, type IsoDate } from "@/lib/dates";
import { eventItem, itemAddress, itemDateLabel, itemTimeLabel, upcomingItems, type FeedItem } from "@/lib/feed";
import { FEED_ID, inlineCall, refreshFeed } from "@/lib/feed-dom";
import { eventEntry, gatheringEntry, googleCalendarUrl } from "@/lib/ics";
import { formatClockRange, weekdayName } from "@/lib/schedule";

/** How many upcoming nights a weekly page lists. */
const NIGHTS_SHOWN = 4;

/** Everything the page shows, for a one-off event or a weekly night. */
type EventView = {
  slug: string;
  title: string;
  description?: string;
  photo?: PhotoData;
  audience: Audience;
  featured: boolean;
  weekly: boolean;
  /** "Saturday, October 10", or "Every Wednesday". */
  date: string;
  /** "9 AM–12 PM". */
  time: string;
  locationName?: string;
  address?: string;
  costNote?: string;
  /** When the calendar buttons give way to "already happened". Weekly nights don't end. */
  endsAt: number | null;
  ended: boolean;
  googleCalendar: string;
  /** The next few weekly nights, plus one spare in case the first ends while the page is open. */
  nights: FeedItem[];
  today: IsoDate;
};

export async function generateStaticParams() {
  return (await getEventSlugs()).map((slug) => ({ slug }));
}

/**
 * Every event is known when the site builds, so any other slug is a 404.
 * Letting it block, instead of streaming a loading shell, means it gets a
 * real 404 status.
 */
export const instant = false;

/**
 * Cached like the feed, so the dates and "already happened" stay current
 * as the page is rebuilt. The browser hides the calendar buttons if the
 * event ends between rebuilds.
 */
async function load(slug: string): Promise<EventView | null> {
  "use cache";
  cacheLife("feed");

  const content = await getBySlug(slug);
  if (!content) return null;
  const now = new Date();
  const today = todayInLA(now);
  const church = formatAddress();

  if (content.kind === "gathering") {
    const { gathering } = content;
    return {
      slug,
      title: gathering.title,
      description: gathering.description,
      photo: gathering.photo,
      audience: gathering.audience,
      featured: false,
      weekly: true,
      date: `Every ${weekdayName(gathering.weekday)}`,
      time: formatClockRange(gathering.startTime, gathering.endTime),
      locationName: gathering.locationName,
      address: church,
      endsAt: null,
      ended: false,
      googleCalendar: googleCalendarUrl(gatheringEntry(gathering, church, now)),
      nights: upcomingItems({ gatherings: [gathering], events: [], now, days: 7 * (NIGHTS_SHOWN + 1) }).slice(
        0,
        NIGHTS_SHOWN + 1,
      ),
      today,
    };
  }

  const { event } = content;
  const item = eventItem(event);
  const endsAt = Date.parse(event.endsAt);
  return {
    slug,
    title: event.title,
    description: event.description,
    photo: event.photo,
    audience: event.audience,
    featured: event.featured,
    weekly: false,
    date: itemDateLabel(item, today),
    time: itemTimeLabel(item),
    locationName: event.locationName,
    address: itemAddress(item, church),
    costNote: event.costNote,
    endsAt,
    ended: endsAt <= now.getTime(),
    googleCalendar: googleCalendarUrl(eventEntry(event, church)),
    nights: [],
    today,
  };
}

export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const view = await load(slug);
  // The page itself calls notFound(). This only names the tab.
  if (!view) return { title: "Page not found" };
  const description = [view.date, view.time, view.locationName].filter(Boolean).join(" · ");
  return {
    title: view.title,
    description,
    alternates: { canonical: `/events/${slug}` },
    openGraph: { title: view.title, description, url: `/events/${slug}`, siteName: site.name, type: "website" },
  };
}

export default async function EventPage({ params }: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  const view = await load(slug);
  if (!view) notFound();

  return (
    <div id={FEED_ID} data-for="all" suppressHydrationWarning className="pb-16 lg:pb-24">
      <Hero view={view} />

      <div className="page-x mt-8 grid gap-12 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <DetailsCard view={view} />
        <div className="flex min-w-0 flex-col gap-12 lg:col-start-1 lg:row-start-1 lg:gap-16">
          {view.description && <About text={view.description} />}
          {view.weekly && <NextNights view={view} />}
          <FirstTime />
        </div>
      </div>

      <InlineScript html={inlineCall(refreshFeed)} />
      <FeedGuard />
    </div>
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
          sizes="(min-width: 1264px) 1200px, (min-width: 1024px) calc(100vw - 64px), 100vw"
          eager
          className="-z-10"
        />
        <div className="absolute inset-0 -z-10 bg-linear-to-t from-black/95 via-black/55 to-black/25" />
        <div className="flex min-h-[max(26rem,min(34rem,72svh))] flex-col px-5 pt-4 pb-8 lg:min-h-[32rem] lg:px-12 lg:pt-8 lg:pb-12">
          <ButtonLink href="/this-week" variant="light" size="sm" className="self-start">
            <ArrowLeft aria-hidden />
            This week
          </ButtonLink>
          <div className="mt-auto pt-16">
            <div className="flex flex-wrap gap-1.5">
              {view.featured && (
                <Tag tone="solid">
                  <Star aria-hidden className="mr-1 size-3 fill-current" />
                  Featured
                </Tag>
              )}
              {view.weekly && (
                <Tag>
                  <Repeat aria-hidden className="mr-1 size-3" />
                  Weekly
                </Tag>
              )}
              {view.audience !== "all" && <AudienceTag audience={view.audience} />}
            </div>
            <h1 className="mt-4 max-w-4xl font-display text-display text-balance">{view.title}</h1>
            <p className="mt-4 font-display text-h3 font-bold text-accent">{view.date}</p>
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
          </div>
        </div>
      </header>
    </div>
  );
}

const who: Record<Audience, string> = {
  all: "Everyone",
  hs: "High school students",
  college: "College students",
};

/**
 * The facts and the calendar buttons. On phones it comes right after the
 * poster; on desktop it rides along beside the description.
 */
function DetailsCard({ view }: { view: EventView }) {
  return (
    <aside
      aria-label="Details"
      data-scope
      className="min-w-0 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:self-start"
    >
      <div className="rounded-card bg-surface p-5 ring-1 ring-line ring-inset sm:p-6">
        <dl className="flex flex-col gap-5">
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
          <Detail icon={<Users />} term="Who">
            <p className="font-semibold">{who[view.audience]}</p>
          </Detail>
        </dl>

        <div
          data-item
          data-show="all"
          data-until={view.endsAt ?? undefined}
          hidden={view.ended || undefined}
          suppressHydrationWarning
          className="mt-6 flex flex-col gap-2 border-t border-line pt-6"
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
          data-empty="all"
          data-show={view.ended ? "all" : ""}
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
      <div className="mt-4 flex max-w-2xl flex-col gap-4 text-lg leading-relaxed text-pretty sm:text-xl sm:leading-relaxed">
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
            data-show="all"
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
        data-empty="all"
        data-show={view.nights.length > 0 ? "" : "all"}
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

function FirstTime() {
  return (
    <aside className="flex flex-col items-start gap-4 rounded-card bg-surface p-6 ring-1 ring-line ring-inset sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div>
        <p className="font-display text-h3 font-bold">First time coming?</p>
        <p className="mt-1 text-small text-muted">Where to park, what to expect, and who to look for.</p>
      </div>
      <ButtonLink href="/visit" variant="secondary">
        Plan a visit
        <ArrowRight aria-hidden />
      </ButtonLink>
    </aside>
  );
}

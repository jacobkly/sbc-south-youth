import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { Suspense, type ReactNode } from "react";
import { ButtonLink, buttonClasses } from "@/components/button";
import { SocialIcon } from "@/components/icons/social-icon";
import { InlineScript } from "@/components/inline-script";
import { AnnouncementCard } from "@/components/site/announcement-card";
import { AudienceChips, AudienceChipsFallback } from "@/components/site/audience-chips";
import { DateBlock } from "@/components/site/date-block";
import { EventCard } from "@/components/site/event-card";
import { FeedGuard } from "@/components/site/feed-guard";
import { PageIntro } from "@/components/site/page-intro";
import { SubscribeCard } from "@/components/site/subscribe-card";
import { pages } from "@/content/pages";
import { site } from "@/content/site";
import { audienceFilters, showKeys } from "@/lib/audience";
import { getAnnouncements, getEvents, getSchedule } from "@/lib/content/loaders";
import type { Announcement } from "@/lib/content/types";
import { addDays, formatDateRange, formatWeekdayDate, todayInLA, type IsoDate } from "@/lib/dates";
import { groupAgenda, liveAnnouncements, upcomingItems, type AgendaGroup } from "@/lib/feed";
import { FEED_ID, applyUrlAudience, inlineCall, refreshFeed } from "@/lib/feed-dom";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata(pages.thisWeek);

const PATH = pages.thisWeek.path;

export default function ThisWeekPage() {
  return (
    <>
      <PageIntro eyebrow={pages.thisWeek.eyebrow} title={pages.thisWeek.heading}>
        Youth nights, events, and announcements for the next few weeks.
      </PageIntro>
      <Feed />
    </>
  );
}

/**
 * The whole feed, rendered ahead of time and refreshed every few
 * minutes. The browser hides anything that ends between refreshes and
 * applies the audience filter, so the page never waits on the server.
 */
async function Feed() {
  "use cache";
  cacheLife("feed");

  const now = new Date();
  const [gatherings, events, announcements] = await Promise.all([getSchedule(), getEvents(), getAnnouncements()]);
  const groups = groupAgenda(upcomingItems({ gatherings, events, now }), now);
  const posts = liveAnnouncements(announcements, now);
  const today = todayInLA(now);

  return (
    <div id={FEED_ID} data-for="all" suppressHydrationWarning className="group/feed pb-16 lg:pb-24">
      {/* Before the chips paint, so a shared `?for=` link never flashes. */}
      <InlineScript html={inlineCall(applyUrlAudience, audienceFilters)} />

      <div className="sticky top-[env(safe-area-inset-top)] z-20 border-y border-line bg-bg/85 backdrop-blur-xl backdrop-saturate-150 lg:top-[4.5rem]">
        <div className="page-x py-2.5">
          <Suspense fallback={<AudienceChipsFallback path={PATH} />}>
            <AudienceChips path={PATH} />
          </Suspense>
        </div>
      </div>

      <div
        className={`page-x mt-8 grid gap-14 lg:mt-12 ${posts.length > 0 ? "lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-x-12 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-x-16" : "max-w-4xl"}`}
      >
        {posts.length > 0 && <HeadsUp posts={posts} />}
        <Agenda groups={groups} today={today} />
      </div>

      <InlineScript html={inlineCall(refreshFeed)} />
      <FeedGuard />
    </div>
  );
}

function HeadsUp({ posts }: { posts: Announcement[] }) {
  return (
    <section
      aria-labelledby="heads-up-title"
      data-box
      data-show={showKeys(posts.map((post) => post.audience))}
      suppressHydrationWarning
      className="min-w-0 lg:col-start-2 lg:row-start-1"
    >
      <h2 id="heads-up-title" className="text-eyebrow text-accent-ink uppercase">
        Heads up
      </h2>
      {/* A swipeable row on phones, with the next card peeking in. A column on desktop. */}
      <ul
        tabIndex={0}
        aria-labelledby="heads-up-title"
        className="-mx-5 mt-4 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:gap-4 lg:mx-0 lg:snap-none lg:flex-col lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {posts.map((post, index) => (
          <li
            key={post.id}
            data-item
            data-show={showKeys(post.audience)}
            data-until={Date.parse(post.expiresAt)}
            suppressHydrationWarning
            className="w-[85%] max-w-[22rem] shrink-0 snap-start lg:w-auto lg:max-w-none"
          >
            {/* The first photo is the biggest thing on a phone's first screen. */}
            <AnnouncementCard post={post} eager={index === 0} />
          </li>
        ))}
      </ul>
    </section>
  );
}

const groupCaption: Record<AgendaGroup["id"], (group: AgendaGroup, today: IsoDate) => string> = {
  "this-week": ({ through }, today) => (through === today ? "Today" : `Through ${formatWeekdayDate(through ?? today, today)}`),
  "next-week": ({ from, through }) => formatDateRange(from, through ?? from),
  "coming-up": () => "Special events",
};

function Agenda({ groups, today }: { groups: AgendaGroup[]; today: IsoDate }) {
  const tomorrow = addDays(today, 1);
  const shown = new Set(
    showKeys(groups.flatMap((group) => group.days.flatMap((day) => day.items.map((item) => item.audience)))).split(" "),
  );

  return (
    <div
      data-scope
      // The top of each day's date sticks below the chips as its cards scroll by.
      className="flex min-w-0 flex-col gap-14 [--stick:calc(4.75rem_+_env(safe-area-inset-top))] lg:col-start-1 lg:row-start-1 lg:gap-16 lg:[--stick:9.5rem]"
    >
      {groups.map((group) => (
        <section
          key={group.id}
          aria-labelledby={`${group.id}-title`}
          data-box
          data-show={showKeys(group.days.flatMap((day) => day.items.map((item) => item.audience)))}
          suppressHydrationWarning
        >
          <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id={`${group.id}-title`} className="font-display text-h2">
              {group.title}
            </h2>
            <p className="text-small font-medium text-muted">{groupCaption[group.id](group, today)}</p>
          </header>
          <ol className="mt-6 flex flex-col gap-8 lg:mt-8 lg:gap-10">
            {group.days.map((day) => (
              <li
                key={day.date}
                data-box
                data-show={showKeys(day.items.map((item) => item.audience))}
                data-date={day.date}
                data-rel={day.date === today ? "today" : day.date === tomorrow ? "tomorrow" : ""}
                suppressHydrationWarning
                className="group/day grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3.5 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-6"
              >
                <div className="sticky top-(--stick) self-start">
                  <DateBlock date={day.date} />
                </div>
                <ul className="flex min-w-0 flex-col gap-3">
                  {day.items.map((item) => (
                    <li
                      key={item.key}
                      data-item
                      data-show={showKeys(item.audience)}
                      data-until={Date.parse(item.endsAt)}
                      suppressHydrationWarning
                    >
                      <EventCard item={item} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <EmptyState filter="all" shown={shown}>
        <EmptyCopy title="Nothing on the calendar right now.">
          New events show up here first. We post everything on Instagram too.
        </EmptyCopy>
        <InstagramButton />
      </EmptyState>
      <EmptyState filter="hs" shown={shown}>
        <EmptyCopy title="Nothing for high school in the next few weeks.">
          Check back soon, or see what&apos;s coming up for everyone else.
        </EmptyCopy>
        <ShowEverything />
      </EmptyState>
      <EmptyState filter="college" shown={shown}>
        <EmptyCopy title="Nothing for college in the next few weeks.">
          Check back soon, or see what&apos;s coming up for everyone else.
        </EmptyCopy>
        <ShowEverything />
      </EmptyState>

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

      <SubscribeCard />
    </div>
  );
}

/** Shows under its one filter when nothing else in the agenda does. */
function EmptyState({ filter, shown, children }: { filter: string; shown: Set<string>; children: ReactNode }) {
  return (
    <div
      data-empty={filter}
      data-show={shown.has(filter) ? "" : filter}
      suppressHydrationWarning
      className="flex flex-col items-center gap-5 rounded-card border border-dashed border-line-strong px-6 py-12 text-center"
    >
      {children}
    </div>
  );
}

function EmptyCopy({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="max-w-sm">
      <p className="font-display text-h3 font-bold text-balance">{title}</p>
      <p className="mt-2 text-small text-pretty text-muted">{children}</p>
    </div>
  );
}

function InstagramButton() {
  const instagram = site.socials.find((social) => social.kind === "instagram");
  if (!instagram) return null;
  return (
    <a href={instagram.href} className={buttonClasses({ variant: "secondary" })}>
      <SocialIcon kind="instagram" />
      Follow on Instagram
    </a>
  );
}

function ShowEverything() {
  // A plain link, so the chips and the page both reset.
  return (
    <a href={PATH} className={buttonClasses({ variant: "secondary" })}>
      Show everything
    </a>
  );
}

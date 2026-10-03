import { ArrowRight, ArrowUpRight, Coffee, HandHelping } from "lucide-react";
import { cacheLife } from "next/cache";
import Link from "next/link";
import type { ReactNode } from "react";
import { SocialIcon } from "@/components/icons/social-icon";
import { home } from "@/content/home";
import { leaders } from "@/content/leaders";
import { site } from "@/content/site";
import { standingNotes } from "@/content/standing-notes";
import type { WeeklyGathering } from "@/lib/content/types";
import { getAnnouncements, getEvents, getSchedule } from "@/lib/content/loaders";
import { daysBetween, formatWeekdayDate, todayInLA, type IsoDate } from "@/lib/dates";
import { countdownItems, liveAnnouncements, relativeDay, whenLabels, type FeedItem } from "@/lib/feed";
import { formatClock, weekdayName } from "@/lib/schedule";
import { Avatar } from "./avatar";
import { BentoTile, tileClasses } from "./bento-tile";
import { Spotlight } from "./spotlight";

/** How many of each to send, so a cached page has a next one when the first ends. */
const SPARES = 3;

// Only the first of its kind that hasn't ended shows.
const firstLeft = "h-full [[data-item]:not([hidden])~&]:hidden";

const { highlights } = home;
const instagram = site.socials.find((social) => social.kind === "instagram");

/**
 * The home highlights, sized by importance: the pinned announcement, a
 * countdown to the next featured event (or the next Friday), then
 * the Cafe, Serve, Leaders, and Instagram. When an announcement or event
 * ends, the feed script swaps in the next one, or a fallback when there's
 * none left. Needs the feed root around it, and `RevealScript` after it.
 */
export async function BentoGrid() {
  "use cache";
  cacheLife("feed");

  const now = new Date();
  const [announcements, events, gatherings] = await Promise.all([getAnnouncements(), getEvents(), getSchedule()]);
  const posts = liveAnnouncements(announcements, now).slice(0, SPARES);
  const countdown = countdownItems({ events, gatherings, now, spares: SPARES });
  const today = todayInLA(now);

  return (
    <section aria-labelledby="highlights-title" className="page-x">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <h2 id="highlights-title" className="font-display text-h2 text-balance">
          {highlights.title}
        </h2>
        <Link
          href="/this-week"
          className="group inline-flex items-center gap-1.5 font-semibold text-accent-ink underline-offset-4 hover:underline"
        >
          All of This Week
          <ArrowRight
            aria-hidden
            className="size-4 transition-transform duration-200 ease-out-soft group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </Link>
      </div>

      {/* Rows grow with the width, so tiles keep their shape instead of stretching into strips. */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:gap-4 lg:mt-8 lg:grid-cols-4 lg:grid-rows-[repeat(2,minmax(clamp(15rem,16vw,24rem),auto))_auto] 2xl:grid-cols-5 2xl:grid-rows-[repeat(2,minmax(clamp(15rem,16vw,24rem),auto))]">
        <BentoTile size="spotlight" data-scope>
          {posts.map((post) => (
            <div
              key={post.id}
              data-item
              data-until={Date.parse(post.expiresAt)}
              suppressHydrationWarning
              className={firstLeft}
            >
              <Spotlight post={post} />
            </div>
          ))}
          {standingNotes[0] && (
            <div data-empty hidden={posts.length > 0} suppressHydrationWarning className="h-full">
              <Spotlight post={standingNotes[0]} />
            </div>
          )}
        </BentoTile>

        <BentoTile size="feature" data-scope className="lg:[--reveal-delay:80ms]">
          {countdown.map((item) => (
            <div
              key={item.key}
              data-item
              data-until={Date.parse(item.endsAt)}
              data-date={item.date}
              data-start={Date.parse(item.startsAt)}
              data-rel={relativeDay(item, now)}
              suppressHydrationWarning
              className={`group/count ${firstLeft}`}
            >
              <Countdown item={item} today={today} />
            </div>
          ))}
          <div data-empty hidden={countdown.length > 0} suppressHydrationWarning className="h-full">
            <EveryWeek gatherings={gatherings} />
          </div>
        </BentoTile>

        <BentoTile size="small">
          <Cafe />
        </BentoTile>
        <BentoTile size="small" className="[--reveal-delay:60ms] lg:[--reveal-delay:120ms]">
          <SmallTile
            href="/connect#serve"
            title={highlights.serve.title}
            body={highlights.serve.body}
            art={<TileIcon icon={<HandHelping />} />}
          />
        </BentoTile>
        <BentoTile size="small" className="lg:[--reveal-delay:180ms]">
          <SmallTile
            href="/leaders"
            title={highlights.leaders.title}
            body={highlights.leaders.body}
            art={
              <span className="flex -space-x-2">
                {leaders.slice(0, 3).map((leader) => (
                  <Avatar key={leader.slug} leader={leader} className="size-10 ring-2 ring-surface lg:size-12" />
                ))}
              </span>
            }
          />
        </BentoTile>
        {instagram && (
          <BentoTile size="small" className="[--reveal-delay:60ms] lg:[--reveal-delay:240ms]">
            <SmallTile
              href={instagram.href}
              title={highlights.instagram.title}
              body={highlights.instagram.body}
              art={<TileIcon icon={<SocialIcon kind="instagram" />} />}
            />
          </BentoTile>
        )}
      </div>
    </section>
  );
}

/**
 * Days until the event, then "Tonight" on the day and "Now" once it
 * starts. The feed script keeps the count and the state current.
 */
function Countdown({ item, today }: { item: FeedItem; today: IsoDate }) {
  const when = whenLabels(item, today);
  const later = "group-data-[rel=now]/count:hidden group-data-[rel=today]/count:hidden";

  return (
    <TileLink href={`/events/${item.slug}`} tone="accent" className="min-h-60 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-eyebrow uppercase">
          <span className={`${later} group-data-[rel=tomorrow]/count:hidden`}>Days to go</span>
          <span className="hidden group-data-[rel=tomorrow]/count:inline">Day to go</span>
          <span className="hidden group-data-[rel=today]/count:inline">Starts</span>
          <span className="hidden group-data-[rel=now]/count:inline">Happening</span>
        </p>
        <TileArrow tone="accent" />
      </div>

      <div>
        {/* One height for every state, so nothing moves when it changes. */}
        <p className="flex h-[5.5rem] items-end font-display leading-none font-extrabold tracking-[-0.04em] whitespace-nowrap lg:h-[7rem]">
          <span data-days suppressHydrationWarning className={`text-[6.5rem] leading-[0.8] lg:text-[8.5rem] ${later}`}>
            {daysBetween(today, item.date)}
          </span>
          <span className="hidden text-[3.25rem] group-data-[rel=today]/count:inline">{when.today}</span>
          <span className="hidden items-center gap-3 text-[3.25rem] group-data-[rel=now]/count:flex">
            <span aria-hidden className="relative flex size-3">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-on-accent opacity-50 motion-reduce:animate-none" />
              <span className="relative inline-flex size-3 rounded-full bg-on-accent" />
            </span>
            Now
          </span>
        </p>
        <h3 className="mt-4 font-display text-[1.5rem] leading-[1.1] font-bold text-balance">{item.title}</h3>
        <p className="mt-1 text-small font-medium opacity-75">
          {formatWeekdayDate(item.date, today)}
          {item.locationName && ` · ${item.locationName}`}
        </p>
      </div>
    </TileLink>
  );
}

/** The countdown's place when nothing is featured: the weekly nights. */
function EveryWeek({ gatherings }: { gatherings: WeeklyGathering[] }) {
  return (
    <TileLink href="/this-week" tone="accent" className="min-h-60 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-eyebrow uppercase">Every week</p>
        <TileArrow tone="accent" />
      </div>
      <ul className="grid gap-4">
        {gatherings.map((gathering) => (
          <li key={gathering.slug}>
            <p className="text-small font-semibold opacity-75">
              {weekdayName(gathering.weekday, { plural: true })} · {formatClock(gathering.startTime)}
            </p>
            <h3 className="font-display text-[1.5rem] leading-[1.1] font-bold text-balance">{gathering.title}</h3>
          </li>
        ))}
      </ul>
    </TileLink>
  );
}

function SmallTile({ href, title, body, art }: { href: string; title: string; body: string; art: ReactNode }) {
  return (
    <TileLink href={href} tone="surface" className={smallTile}>
      <div className="flex items-start justify-between gap-2">
        {art}
        <TileArrow tone="surface" />
      </div>
      <SmallText title={title} body={body} />
    </TileLink>
  );
}

function SmallText({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="font-display text-lg leading-tight font-bold text-balance sm:text-h3 lg:text-[1.5rem]">{title}</h3>
      <p className="mt-1 text-small text-pretty text-muted">{body}</p>
    </div>
  );
}

/** The cafe has no page of its own, so this tile isn't a link. */
function Cafe() {
  return (
    <div className={tileClasses("surface", `justify-between gap-5 ${smallTile}`)}>
      <TileIcon icon={<Coffee />} />
      <SmallText title={highlights.cafe.title} body={highlights.cafe.body} />
    </div>
  );
}

const smallTile = "min-h-44 p-3.5 sm:p-5 md:min-h-52 lg:min-h-48 lg:p-6";

const linkTones = {
  accent: "hover:brightness-105",
  surface: "hover:bg-surface-2",
};

function TileLink({
  href,
  tone,
  className,
  children,
}: {
  href: string;
  tone: "accent" | "surface";
  className: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={tileClasses(tone, `group/tile pressable justify-between gap-5 ${linkTones[tone]} ${className}`)}>
      {children}
    </Link>
  );
}

function TileIcon({ icon }: { icon: ReactNode }) {
  return (
    <span
      aria-hidden
      className="grid size-10 place-items-center rounded-full bg-surface-2 text-accent-ink ring-1 ring-line ring-inset lg:size-12 [&_svg]:size-5 lg:[&_svg]:size-6"
    >
      {icon}
    </span>
  );
}

function TileArrow({ tone }: { tone: "accent" | "surface" }) {
  return (
    <ArrowUpRight
      aria-hidden
      className={`size-5 shrink-0 transition-transform duration-200 ease-out-soft group-hover/tile:translate-x-0.5 group-hover/tile:-translate-y-0.5 motion-reduce:transition-none ${
        tone === "accent" ? "" : "text-muted"
      }`}
    />
  );
}

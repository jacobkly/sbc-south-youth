import { CalendarPlus } from "lucide-react";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { ButtonLink, buttonClasses } from "@/components/button";
import { formatAddress } from "@/content/site";
import { getEvents, getSchedule } from "@/lib/content/loaders";
import { todayInLA, type IsoDate } from "@/lib/dates";
import { itemAddress, itemTimeLabel, relativeDay, upcomingItems, whenLabels, type FeedItem } from "@/lib/feed";
import { DirectionsButton } from "./directions-button";

/** How far ahead to look, in days, and how many to send. */
const DAYS = 14;
const SPARES = 4;

/**
 * The next thing on the calendar, with directions and a calendar file.
 * The server sends the next few and the page shows the first one that
 * hasn't ended, so a cached copy stays right as the night goes on. The
 * feed script keeps "Tonight" or "Happening now" current, all on one
 * line, so nothing below it moves. Needs the feed root around it.
 */
export async function NextUpCard() {
  "use cache";
  cacheLife("feed");

  const now = new Date();
  const [gatherings, events] = await Promise.all([getSchedule(), getEvents()]);
  const items = upcomingItems({ gatherings, events, now, days: DAYS }).slice(0, SPARES);
  const today = todayInLA(now);
  const churchAddress = formatAddress();

  return (
    <section
      aria-labelledby="next-up-title"
      data-scope
      className="relative rounded-card bg-surface/85 p-5 ring-1 ring-line-strong backdrop-blur-xl transition-colors ring-inset has-[h3_a:hover]:bg-surface-2/85 sm:p-6"
    >
      <h2 id="next-up-title" className="text-eyebrow text-muted uppercase">
        Next up
      </h2>
      <ul className="mt-3">
        {items.map((item) => (
          <NextUpItem key={item.key} item={item} now={now} today={today} churchAddress={churchAddress} />
        ))}
      </ul>
      <div data-empty hidden={items.length > 0} suppressHydrationWarning className="mt-3">
        <p className="font-display text-h3 font-bold">Nothing on the calendar yet.</p>
        <p className="mt-1 text-small text-muted">New nights and events show up on This Week first.</p>
        <ButtonLink href="/this-week" variant="secondary" size="sm" className="mt-4">
          See This Week
        </ButtonLink>
      </div>
    </section>
  );
}

function NextUpItem({
  item,
  now,
  today,
  churchAddress,
}: {
  item: FeedItem;
  now: Date;
  today: IsoDate;
  churchAddress: string;
}) {
  const when = whenLabels(item, today);
  const address = itemAddress(item, churchAddress);

  return (
    <li
      data-item
      data-until={Date.parse(item.endsAt)}
      data-date={item.date}
      data-start={Date.parse(item.startsAt)}
      data-rel={relativeDay(item, now)}
      suppressHydrationWarning
      // Only the first one that's still on shows.
      className="group/next [li:not([hidden])~&]:hidden"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex h-6 items-center gap-2 font-display text-lg font-bold whitespace-nowrap text-accent-ink">
          <span aria-hidden className="relative hidden size-2 group-data-[rel=now]/next:flex">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-accent" />
          </span>
          <span className="hidden group-data-[rel=now]/next:inline">{when.now}</span>
          <span className="hidden group-data-[rel=today]/next:inline">{when.today}</span>
          <span className="hidden group-data-[rel=tomorrow]/next:inline">{when.tomorrow}</span>
          <span className="group-data-[rel=now]/next:hidden group-data-[rel=today]/next:hidden group-data-[rel=tomorrow]/next:hidden">
            {when.later}
          </span>
        </p>
      </div>

      <h3 className="mt-3 font-display text-[1.75rem] leading-[1.05] font-bold tracking-tight text-balance">
        {/* The whole card opens the event. The buttons sit above it. */}
        <Link href={`/events/${item.slug}`} className="after:absolute after:inset-0 after:rounded-card">
          {item.title}
        </Link>
      </h3>
      <p className="mt-1.5 text-small text-muted">
        {itemTimeLabel(item)}
        {item.locationName && ` · ${item.locationName}`}
      </p>

      {/* Stacked on phones, where the two don't fit side by side. */}
      <div className="relative z-10 mt-5 grid gap-2 sm:flex sm:flex-wrap">
        {address && <DirectionsButton address={address} variant="secondary" size="sm" />}
        <a href={`/events/${item.slug}/calendar.ics`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
          <CalendarPlus aria-hidden />
          {item.kind === "gathering" ? "Add every week" : "Add to calendar"}
        </a>
      </div>
    </li>
  );
}

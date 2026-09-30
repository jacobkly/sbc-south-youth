import { ArrowRight, ArrowUpRight, CalendarDays, HandHeart, MapPin, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { SocialIcon } from "@/components/icons/social-icon";
import { LogoMark } from "@/components/site/logo";
import { pages } from "@/content/pages";
import { site } from "@/content/site";
import { getSchedule } from "@/lib/content/loaders";
import { readServerEnv } from "@/lib/env";
import { pageMetadata } from "@/lib/metadata";
import { formatClock, weekdayName } from "@/lib/schedule";

export const metadata: Metadata = pageMetadata(pages.links);

type LinkItem = { href: string; label: string; note?: string; icon: ReactNode; external?: boolean };

/**
 * The link in our social bios. It stands alone, without the site's nav,
 * and runs no JS of its own: just big buttons that are easy to hit.
 */
export default async function LinksPage() {
  const schedule = await getSchedule();
  const { giveCashtag } = readServerEnv();

  const items: LinkItem[] = [
    { href: "/this-week", label: "This Week", note: "Events and news this week", icon: <CalendarDays /> },
    { href: "/visit", label: "Plan a Visit", note: "Your first night, sorted", icon: <MapPin /> },
    // Never a chat invite link: the Connect page handles who gets added.
    { href: "/connect#join", label: "Join the chat", note: "Stay in the loop all week", icon: <MessageCircle /> },
  ];
  if (giveCashtag) items.push({ href: "/give", label: "Give", note: "Friday food, birthdays, and events", icon: <HandHeart /> });
  for (const link of site.socials) {
    items.push({ href: link.href, label: link.label, icon: <SocialIcon kind={link.kind} />, external: true });
  }

  return (
    <main className="relative isolate min-h-dvh overflow-hidden px-5 pt-[max(3.5rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))]">
      <div aria-hidden className="grain pointer-events-none absolute inset-0 -z-10 opacity-[0.04]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 mx-auto h-[28rem] max-w-2xl bg-[radial-gradient(closest-side,var(--color-accent),transparent)] opacity-20"
      />

      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <LogoMark className="h-16 animate-rise motion-reduce:animate-none" />
        <h1 className="mt-5 animate-rise font-display text-h2 [animation-delay:80ms] motion-reduce:animate-none">
          SBC South <span className="text-accent-ink">Youth</span>
        </h1>
        <p className="mt-2 max-w-xs animate-rise text-pretty text-muted [animation-delay:140ms] motion-reduce:animate-none">
          {site.tagline}
        </p>
        <ul className="mt-5 flex animate-rise flex-wrap justify-center gap-2 [animation-delay:200ms] motion-reduce:animate-none">
          {schedule.map((gathering) => (
            <li key={gathering.slug} className="rounded-full bg-surface px-3 py-1.5 text-small font-medium ring-1 ring-line ring-inset">
              {weekdayName(gathering.weekday, { plural: true })} · {formatClock(gathering.startTime)}
            </li>
          ))}
        </ul>

        <ul className="mt-10 w-full space-y-3">
          {items.map((item, index) => (
            <li
              key={item.href}
              className="animate-rise [animation-delay:var(--delay)] motion-reduce:animate-none"
              style={{ "--delay": `${260 + index * 60}ms` } as CSSProperties}
            >
              <LinkButton item={item} primary={index === 0} />
            </li>
          ))}
        </ul>

        <Link href="/" className="mt-12 inline-flex min-h-11 items-center gap-1.5 text-small font-semibold text-muted hover:text-fg">
          sbcsouthyouth.com
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </div>
    </main>
  );
}

function LinkButton({ item, primary }: { item: LinkItem; primary: boolean }) {
  const Arrow = item.external ? ArrowUpRight : ArrowRight;
  const className = [
    "pressable group flex min-h-18 w-full items-center gap-4 rounded-card p-3 pr-5 text-left",
    primary ? "bg-accent text-on-accent" : "bg-surface ring-1 ring-line ring-inset hover:bg-surface-2",
  ].join(" ");
  const content = (
    <>
      <span
        aria-hidden
        className={`grid size-12 shrink-0 place-items-center rounded-full [&_svg]:size-5 ${
          primary ? "bg-on-accent text-accent" : "bg-surface-2 ring-1 ring-line ring-inset"
        }`}
      >
        {item.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg leading-tight font-bold">{item.label}</span>
        {item.note && <span className={`block text-small ${primary ? "" : "text-muted"}`}>{item.note}</span>}
      </span>
      <Arrow
        aria-hidden
        className="size-5 shrink-0 transition-transform duration-200 ease-out-soft group-hover:translate-x-0.5 motion-reduce:transition-none"
      />
    </>
  );

  return item.external ? (
    <a href={item.href} className={className}>
      {content}
    </a>
  ) : (
    <Link href={item.href} className={className}>
      {content}
    </Link>
  );
}

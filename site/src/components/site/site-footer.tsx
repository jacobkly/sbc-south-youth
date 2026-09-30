import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { SocialIcon } from "@/components/icons/social-icon";
import { site } from "@/content/site";
import { getSchedule } from "@/lib/content/loaders";
import { formatClockRange, weekdayName } from "@/lib/schedule";
import { LogoMark } from "./logo";

const exploreLinks = [
  { href: "/this-week", label: "This Week" },
  { href: "/visit", label: "Plan a Visit" },
  { href: "/connect", label: "Connect & Serve" },
  { href: "/leaders", label: "Leaders" },
  { href: "/parents", label: "Parents & Safety" },
  { href: "/give", label: "Give" },
  { href: "/contact", label: "Contact" },
];

const linkClasses = "inline-flex min-h-11 items-center hover:text-accent-ink";

function Column({ title, className = "", children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <h2 className="text-eyebrow text-muted uppercase">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export async function SiteFooter() {
  const { address } = site;
  const schedule = await getSchedule();

  return (
    <footer className="relative mt-24 overflow-hidden border-t border-line lg:mt-32">
      <div className="page-x grid grid-cols-2 gap-x-6 gap-y-10 pt-12 lg:grid-cols-12 lg:gap-x-(--grid-gap) lg:pt-16">
        <div className="col-span-2 lg:col-span-4">
          <Link href="/" className="pressable inline-flex min-h-11 items-center gap-3 font-display text-h3 font-extrabold">
            <LogoMark className="h-10" />
            {site.name}
          </Link>
          <p className="mt-4 max-w-xs text-muted">{site.tagline}</p>
          <ul className="mt-5 flex gap-2">
            {site.socials.map((social) => (
              <li key={social.kind}>
                <a
                  href={social.href}
                  className="pressable grid size-11 place-items-center rounded-full ring-1 ring-line-strong ring-inset hover:bg-surface-2"
                >
                  <SocialIcon kind={social.kind} />
                  <span className="sr-only">{social.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <Column title="When" className="lg:col-span-2">
          <dl className="space-y-3">
            {schedule.map((gathering) => (
              <div key={gathering.slug}>
                <dt className="font-semibold">{weekdayName(gathering.weekday, { plural: true })}</dt>
                <dd className="text-muted">
                  <span className="whitespace-nowrap">{formatClockRange(gathering.startTime, gathering.endTime)}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Column>

        <Column title="Find us" className="lg:col-span-3">
          <address className="text-muted not-italic">
            <span className="font-semibold text-fg">{site.campus}</span>
            <br />
            {address.street}
            <br />
            {address.city},{" "}
            <span className="whitespace-nowrap">
              {address.region} {address.postalCode}
            </span>
          </address>
          <Link href="/visit" className={`${linkClasses} gap-1 font-semibold`}>
            Plan a visit <ArrowUpRight aria-hidden className="size-4" />
          </Link>
        </Column>

        <Column title="Explore" className="col-span-2 lg:col-span-3">
          <ul className="grid grid-cols-2 gap-x-6 lg:grid-cols-1 2xl:grid-cols-2">
            {exploreLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={`${linkClasses} w-full`}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </Column>
      </div>

      <div className="page-x mt-10 flex items-center justify-between gap-4 border-t border-line pt-2 text-small text-muted">
        <p>
          Part of{" "}
          <a href={site.church.href} className={`${linkClasses} gap-0.5 text-fg`}>
            {site.church.name}
            <ArrowUpRight aria-hidden className="size-3.5" />
          </a>
        </p>
        <Link href="/privacy" className={linkClasses}>
          Privacy
        </Link>
      </div>

      {/* A poster-sized sign-off, sized to fill the frame at any width. On
          desktop it sinks below the bottom edge; on phones the tab bar sits
          there, so it stays whole. */}
      <div aria-hidden className="page-x @container select-none">
        <p className="mt-4 mb-4 text-center font-display text-[length:16cqi] leading-[0.8] font-extrabold tracking-[-0.04em] whitespace-nowrap text-fg/[0.07] lg:-mb-[0.18em]">
          SOUTH YOUTH
        </p>
      </div>
    </footer>
  );
}

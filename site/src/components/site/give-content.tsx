import { ArrowRight, ArrowUpRight, Info, Landmark, Mail, ReceiptText } from "lucide-react";
import Link from "next/link";
import { ButtonLink, buttonClasses } from "@/components/button";
import { give } from "@/content/give";
import { site } from "@/content/site";
import { cashAppUrl } from "@/lib/cash-app";
import { CopyButton } from "./copy-button";
import { FaqAccordion } from "./faq-accordion";
import { PageIntro } from "./page-intro";
import { Photo } from "./photo";
import { PolicyCard } from "./policy-card";
import { QrCode } from "./qr-code";
import { SectionHeader } from "./section-header";

const linkClasses = "font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-accent-ink";

const receiptHref = `mailto:${site.email}?subject=${encodeURIComponent("Receipt for my gift")}`;

/**
 * The Give page. With a cashtag it's the Cash App button, the cashtag to
 * copy, a QR code, and the fine print. Without one it's a "coming soon"
 * card, so the page never links to an account that isn't set up.
 */
export function GiveContent({ cashtag }: { cashtag: string | null }) {
  return (
    <>
      <PageIntro eyebrow="Give" title="Fuel the mission.">
        {give.why}
      </PageIntro>

      {cashtag ? <GiveCard cashtag={cashtag} /> : <ComingSoonCard />}

      <section aria-labelledby="impact-title" className="page-x mt-16 lg:mt-24">
        <SectionHeader id="impact-title" eyebrow="Where it goes" title="What your gift does" />
        <ul className="mt-6 grid gap-4 md:grid-cols-3 lg:gap-6">
          {give.impact.map((item) => (
            <li
              key={item.title}
              data-theme="dark"
              className="relative isolate flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-card p-5 text-white sm:aspect-[16/9] md:aspect-[4/5] lg:p-6"
            >
              {/* The text says what the photo shows, so it's decorative here. */}
              <Photo
                photo={{ ...item.photo, alt: "" }}
                seed={item.title}
                sizes="(min-width: 1240px) 400px, (min-width: 768px) 33vw, 100vw"
                className="-z-10"
              />
              <div className="absolute inset-0 -z-10 bg-linear-to-t from-black/90 via-black/45 to-black/0" />
              <p className="font-display text-[4.5rem] leading-[0.85] font-extrabold tracking-[-0.05em] text-accent lg:text-[5.5rem]">
                <span className="sr-only">Gift of </span>${item.dollars}
              </p>
              <h3 className="mt-3 text-h3">{item.title}</h3>
              <p className="mt-1 text-pretty text-white/75">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {cashtag && (
        <>
          <section aria-labelledby="records-title" className="page-x mt-16 lg:mt-24">
            <SectionHeader id="records-title" eyebrow="For your records" title="Receipts and taxes" />
            <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:gap-6">
              <li>
                <PolicyCard point={give.receipt} icon={<ReceiptText />}>
                  <a href={receiptHref} className={buttonClasses({ variant: "secondary", className: "w-full sm:w-auto" })}>
                    <Mail aria-hidden />
                    Email for a receipt
                  </a>
                </PolicyCard>
              </li>
              <li>
                <PolicyCard point={give.tax} icon={<Landmark />} />
              </li>
            </ul>
          </section>

          <section id="camp" aria-labelledby="camp-title" className="page-x mt-16 scroll-mt-24 lg:mt-24">
            <div className="grid items-center gap-10 overflow-hidden rounded-card bg-surface p-5 ring-1 ring-line ring-inset sm:p-8 md:grid-cols-2 lg:gap-16 lg:p-14">
              <div>
                <p className="text-eyebrow text-accent-ink uppercase">Events</p>
                <h2 id="camp-title" className="mt-2 font-display text-h2 text-balance">
                  Paying for an event?
                </h2>
                <p className="mt-3 max-w-md text-pretty text-muted">{give.eventPayments.body}</p>
                <p className="mt-4 flex max-w-md gap-3 rounded-tile bg-surface-2 p-4 text-small text-pretty">
                  <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-ink" />
                  {give.eventPayments.notDonation}
                </p>
                <Link href="/this-week" className={`mt-6 inline-flex min-h-11 items-center gap-1.5 ${linkClasses}`}>
                  See upcoming events <ArrowRight aria-hidden className="size-4" />
                </Link>
              </div>
              <PaymentNoteExample cashtag={cashtag} />
            </div>
          </section>

          <section aria-labelledby="give-faq-title" className="page-x mt-16 lg:mt-24">
            <div className="grid gap-6 lg:grid-cols-[1fr_2fr] lg:gap-12">
              <div className="lg:sticky lg:top-24 lg:self-start">
                <SectionHeader id="give-faq-title" eyebrow="Questions" title="Good to know">
                  Anything else?{" "}
                  <Link href="/contact" className={linkClasses}>
                    Ask us
                  </Link>
                  .
                </SectionHeader>
              </div>
              <FaqAccordion items={give.faq} name="give-faq" />
            </div>
          </section>
        </>
      )}
    </>
  );
}

/** The big accent card: the cashtag, the Cash App button, and a QR code. */
function GiveCard({ cashtag }: { cashtag: string }) {
  const url = cashAppUrl(cashtag);
  // Sized so the whole cashtag fits on one line at any width, up to a cap.
  const fit = `min(5.5rem, ${(100 / (cashtag.length * 0.6)).toFixed(2)}cqw)`;

  return (
    <section aria-labelledby="give-title" className="page-x">
      <div className="relative isolate grid overflow-hidden rounded-card bg-accent text-on-accent md:grid-cols-[1fr_auto]">
        <p
          aria-hidden
          className="absolute -bottom-20 -left-6 -z-10 font-display text-[16rem] leading-none font-extrabold opacity-[0.07] select-none lg:-bottom-28 lg:text-[22rem]"
        >
          $
        </p>

        <div className="@container p-6 sm:p-10 lg:p-14">
          <h2 id="give-title" className="text-eyebrow uppercase">
            Give with Cash App
          </h2>
          <p
            className="mt-3 font-display leading-[0.95] font-extrabold tracking-[-0.04em] [overflow-wrap:anywhere]"
            style={{ fontSize: fit }}
          >
            {cashtag}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href={url} className={buttonClasses({ variant: "inverse", size: "lg" })}>
              Give with Cash App
              <ArrowUpRight aria-hidden />
            </a>
            <CopyButton text={cashtag} label="Copy cashtag" variant="inverse-outline" size="lg" className="sm:min-w-52" />
          </div>
        </div>

        <div className="flex items-center gap-5 border-t border-on-accent/15 p-6 sm:px-10 md:flex-col md:justify-center md:gap-4 md:border-t-0 md:border-l md:px-10 lg:px-14">
          <QrCode
            value={url}
            label={`QR code that opens Cash App to ${cashtag}`}
            className="w-28 shrink-0 rounded-tile shadow-[0_12px_32px_-12px_rgb(0_0_0/0.45)] md:w-44 lg:w-52"
          />
          <p className="max-w-44 text-small text-pretty md:text-center">
            Giving from a laptop? Scan this with your phone&apos;s camera.
          </p>
        </div>
      </div>
    </section>
  );
}

/** What a payment for an event should look like, with the note that matters picked out. */
function PaymentNoteExample({ cashtag }: { cashtag: string }) {
  const rows = [
    { label: "To", value: cashtag },
    { label: "Amount", value: "$40" },
  ];

  return (
    <figure className="mx-auto w-full max-w-sm">
      <div className="rotate-[-2deg] rounded-card bg-bg p-5 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.5)] ring-1 ring-line-strong ring-inset sm:p-6">
        <dl className="divide-y divide-line">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4 py-3 first:pt-0">
              <dt className="text-small text-muted">{row.label}</dt>
              <dd className="truncate font-semibold">{row.value}</dd>
            </div>
          ))}
          <div className="pt-3">
            <dt className="text-small text-muted">For</dt>
            <dd className="mt-2 rounded-tile bg-accent px-4 py-3 font-display text-lg leading-snug font-bold text-balance text-on-accent">
              Your name · Event name
            </dd>
          </div>
        </dl>
      </div>
      <figcaption className="mt-5 text-center text-small text-muted">An example. Copy the exact note from your confirmation.</figcaption>
    </figure>
  );
}

/** Stands in for the give card until the cashtag is set. */
function ComingSoonCard() {
  return (
    <section aria-labelledby="soon-title" className="page-x">
      <div className="relative isolate overflow-hidden rounded-card bg-surface p-6 ring-1 ring-line ring-inset sm:p-10 lg:p-14">
        <p
          aria-hidden
          className="absolute -right-4 -bottom-20 -z-10 font-display text-[16rem] leading-none font-extrabold text-fg opacity-[0.05] select-none lg:-bottom-28 lg:text-[22rem]"
        >
          $
        </p>
        <p className="inline-flex items-center gap-2.5 rounded-full bg-surface-2 px-3.5 py-1.5 text-small font-semibold ring-1 ring-line ring-inset">
          <span aria-hidden className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent-ink opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-accent-ink" />
          </span>
          Coming soon
        </p>
        <h2 id="soon-title" className="mt-5 max-w-xl font-display text-h1 text-balance">
          Online giving is almost here.
        </h2>
        <p className="mt-3 max-w-md text-pretty text-muted">
          We&apos;re still setting it up. Until then, send us a message and we&apos;ll tell you how to give.
        </p>
        <ButtonLink href="/contact" size="lg" className="mt-8 w-full sm:w-auto">
          Ask how to give
          <ArrowRight aria-hidden />
        </ButtonLink>
      </div>
    </section>
  );
}

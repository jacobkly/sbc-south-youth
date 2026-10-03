import { ArrowRight, ArrowUpRight, Landmark, Mail, ReceiptText } from "lucide-react";
import Link from "next/link";
import { ButtonLink, buttonClasses } from "@/components/button";
import { give } from "@/content/give";
import { pages } from "@/content/pages";
import { site } from "@/content/site";
import { cashAppUrl } from "@/lib/cash-app";
import { getPhotos } from "@/lib/content/loaders";
import type { Photo as PhotoData } from "@/lib/content/types";
import { photoSizes } from "@/lib/photo-sizes";
import { CopyButton } from "./copy-button";
import { FaqAccordion } from "./faq-accordion";
import { PageIntro } from "./page-intro";
import { Photo } from "./photo";
import { PolicyCard } from "./policy-card";
import { QrCode } from "./qr-code";
import { SectionHeader } from "./section-header";

const linkClasses = "font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-accent-ink";

/** A photo whose text beside it says what it shows, so screen readers skip it. */
function decorative(photo: PhotoData | undefined): PhotoData | undefined {
  return photo && { ...photo, alt: "" };
}

const receiptHref = `mailto:${site.email}?subject=${encodeURIComponent("Receipt for my gift")}`;

/**
 * The Give page. With a cashtag it's the Cash App button, the cashtag to
 * copy, a QR code, and the fine print. Without one it's a "coming soon"
 * card, so the page never links to an account that isn't set up.
 */
export async function GiveContent({ cashtag }: { cashtag: string | null }) {
  const { spots } = await getPhotos();

  return (
    <>
      <PageIntro title={pages.give.heading}>{give.why}</PageIntro>

      {/* From xl up the ask takes 5 columns and where the money goes takes the other 7. */}
      <div className="page-x xl:grid xl:grid-cols-12 xl:gap-x-(--grid-gap)">
        {cashtag ? <GiveCard cashtag={cashtag} /> : <ComingSoonCard />}

        <section aria-labelledby="impact-title" className="mt-16 lg:mt-24 xl:col-span-7 xl:mt-0">
          <SectionHeader id="impact-title" title="Where your gift goes" />
          {/* Photo cards, then from xl up a list with a big number. */}
          <ul className="mt-6 grid gap-4 md:grid-cols-3 lg:gap-6 xl:grid-cols-1 xl:gap-0 xl:divide-y xl:divide-line xl:border-y xl:border-line">
            {give.impact.map((item) => (
              <li
                key={item.title}
                className="relative isolate flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-card p-5 text-white sm:aspect-[16/9] md:aspect-[4/5] lg:p-6 xl:grid xl:aspect-auto xl:grid-cols-[2fr_3fr] xl:items-baseline xl:gap-x-(--grid-gap) xl:rounded-none xl:px-0 xl:py-8 xl:text-fg"
              >
                <div data-theme="dark" className="absolute inset-0 -z-10 xl:hidden">
                  {/* The text says what the photo shows, so it's decorative here. */}
                  <Photo
                    photo={decorative(spots[item.spot])}
                    seed={item.title}
                    sizes={photoSizes({ lg: 1 / 3, md: 1 / 3 })}
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/80 via-60% to-black/35" />
                </div>
                <p className="mb-3 font-display text-[4.5rem] leading-[0.85] font-extrabold tracking-[-0.05em] text-accent lg:text-[5.5rem] xl:mb-0 xl:text-[clamp(3rem,4vw,5rem)] xl:text-accent-ink">
                  ${item.dollars}
                </p>
                <div>
                  <h3 className="text-h3">{item.title}</h3>
                  <p className="mt-1 text-pretty text-white/75 xl:text-muted">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* From xl up the list drops its photos, so one band carries the food photo. */}
      <div aria-hidden className="page-x mt-24 hidden xl:block">
        {/* A set width keeps the height cap from narrowing the band through its aspect ratio. */}
        <div className="relative aspect-[3/1] max-h-[60vh] w-full overflow-hidden rounded-card">
          <Photo photo={decorative(spots["give-band"])} seed="give-band" sizes={photoSizes({ lg: 1 })} />
        </div>
      </div>

      {cashtag && (
        <>
          <section
            aria-labelledby="records-title"
            className="page-x mt-16 lg:mt-24 xl:grid xl:grid-cols-12 xl:gap-x-(--grid-gap)"
          >
            <div className="xl:col-span-4">
              <SectionHeader id="records-title" title="Receipts and taxes" />
            </div>
            {/* From xl up the cards open into rows beside the heading. */}
            <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:gap-6 xl:col-span-8 xl:mt-0 xl:grid-cols-1 xl:gap-0 xl:divide-y xl:divide-line xl:border-y xl:border-line">
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

          <section aria-labelledby="give-faq-title" className="page-x mt-16 lg:mt-24">
            <div className="grid gap-6 lg:grid-cols-[minmax(20rem,1fr)_2fr] lg:gap-12 xl:grid-cols-12 xl:gap-x-(--grid-gap)">
              <div className="lg:sticky lg:top-24 lg:self-start xl:col-span-4">
                <SectionHeader id="give-faq-title" title="Questions">
                  Anything else?{" "}
                  <Link href="/contact" className={linkClasses}>
                    Ask us
                  </Link>
                  .
                </SectionHeader>
              </div>
              <FaqAccordion items={give.faq} name="give-faq" className="xl:col-span-8" />
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
    <section aria-labelledby="give-title" className="xl:col-span-5">
      <div className="relative isolate grid overflow-hidden rounded-card bg-accent text-on-accent md:grid-cols-[1fr_auto] xl:grid-cols-1">
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

        {/* Beside the cashtag from md, then under it again in the narrower column from xl. */}
        <div className="flex items-center gap-5 border-t border-on-accent/15 p-6 sm:px-10 md:flex-col md:justify-center md:gap-4 md:border-t-0 md:border-l md:px-10 lg:px-14 xl:flex-row xl:justify-start xl:gap-6 xl:border-t xl:border-l-0 xl:py-8">
          <QrCode
            value={url}
            label={`QR code that opens Cash App to ${cashtag}`}
            className="w-28 shrink-0 rounded-tile shadow-[0_12px_32px_-12px_rgb(0_0_0/0.45)] md:w-44 lg:w-52 xl:w-36"
          />
          <p className="max-w-44 text-small text-pretty md:text-center xl:text-left">
            Giving from a laptop? Scan this with your phone&apos;s camera.
          </p>
        </div>
      </div>
    </section>
  );
}

/** Stands in for the give card until the cashtag is set. */
function ComingSoonCard() {
  return (
    <section aria-labelledby="soon-title" className="xl:col-span-5">
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
          Online giving is almost here
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

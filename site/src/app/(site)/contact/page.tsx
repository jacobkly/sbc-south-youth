import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/forms/contact-form";
import { SocialIcon } from "@/components/icons/social-icon";
import { CopyButton } from "@/components/site/copy-button";
import { PageIntro } from "@/components/site/page-intro";
import { pages } from "@/content/pages";
import { site } from "@/content/site";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata(pages.contact);

const cardClasses = "rounded-card bg-surface p-5 ring-1 ring-line ring-inset sm:p-6";

export default function ContactPage() {
  return (
    <>
      <PageIntro title={pages.contact.heading}>
        Questions about youth nights, events, or anything else? Send us a message and a leader will write back.
      </PageIntro>

      <div className="page-x grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-8">
        <section aria-labelledby="message-title" className="rounded-card bg-surface p-5 ring-1 ring-line ring-inset sm:p-8">
          <h2 id="message-title" className="sr-only">
            Send a message
          </h2>
          <ContactForm />
        </section>

        <aside aria-label="Other ways to reach us" className="grid gap-4 lg:sticky lg:top-24">
          <div className={cardClasses}>
            <p className="text-eyebrow text-accent-ink uppercase">Rather email?</p>
            <a
              href={`mailto:${site.email}`}
              className="mt-2 block font-display text-h3 break-all underline decoration-line-strong underline-offset-4 hover:decoration-accent-ink"
            >
              {site.email}
            </a>
            <CopyButton text={site.email} label="Copy email" size="sm" className="mt-4" />
          </div>

          <div className={cardClasses}>
            <p className="text-eyebrow text-accent-ink uppercase">For parents</p>
            <p className="mt-2 text-pretty text-muted">
              Ask any youth leader at church, or use this form and pick &ldquo;Parent or guardian.&rdquo;
            </p>
            <Link
              href="/parents"
              className="mt-4 inline-block font-medium underline decoration-line-strong underline-offset-4 hover:decoration-accent-ink"
            >
              How we look after students
            </Link>
          </div>

          <div className={`${cardClasses} flex items-center justify-between gap-4`}>
            <p className="text-small text-muted">
              Or find us on social.{" "}
              <Link href="/privacy" className="font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-accent-ink">
                How we handle messages
              </Link>
            </p>
            <ul className="-mr-2 flex shrink-0">
              {site.socials.map((social) => (
                <li key={social.kind}>
                  <a href={social.href} className="pressable grid size-11 place-items-center rounded-full text-fg hover:bg-surface-2">
                    <SocialIcon kind={social.kind} className="size-[22px]" />
                    <span className="sr-only">{social.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}

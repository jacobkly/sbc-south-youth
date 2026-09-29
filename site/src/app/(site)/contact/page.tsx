import { Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/button";
import { ContactForm } from "@/components/forms/contact-form";
import { SocialIcon } from "@/components/icons/social-icon";
import { Avatar } from "@/components/site/avatar";
import { CopyButton } from "@/components/site/copy-button";
import { PageIntro } from "@/components/site/page-intro";
import { leaders, parentContactSlug } from "@/content/leaders";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Questions about youth nights, events, or anything else? Send us a message.",
};

const cardClasses = "rounded-card bg-surface p-5 ring-1 ring-line ring-inset sm:p-6";

export default function ContactPage() {
  const pastor = leaders.find((leader) => leader.slug === parentContactSlug);
  const pastorFirstName = pastor?.name.trim().split(/\s+/)[0];

  return (
    <>
      <PageIntro eyebrow="Contact" title="Say hi.">
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

          {pastor && (
            <div className={cardClasses}>
              <div className="flex items-center gap-4">
                <Avatar leader={pastor} className="size-14" />
                <div className="min-w-0">
                  <p className="text-eyebrow text-accent-ink uppercase">For parents</p>
                  <p className="mt-1 font-semibold">{pastor.name}</p>
                  <p className="text-small text-muted">{pastor.role}</p>
                </div>
              </div>
              <p className="mt-4 text-pretty text-muted">
                Questions about safety, a trip, or your student? You can write to {pastorFirstName} directly.
              </p>
              {pastor.email && (
                <a
                  href={`mailto:${pastor.email}`}
                  className={buttonClasses({ variant: "secondary", className: "mt-4 w-full sm:w-auto" })}
                >
                  <Mail aria-hidden />
                  Email {pastorFirstName}
                </a>
              )}
            </div>
          )}

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

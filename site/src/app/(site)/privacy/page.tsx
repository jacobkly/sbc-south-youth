import { ArrowUpRight, BadgeX, Clock, Inbox, UserCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageIntro } from "@/components/site/page-intro";
import { SectionHeader } from "@/components/site/section-header";
import { privacy } from "@/content/privacy";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What our forms collect, why we ask, and how long we keep it.",
};

const linkClasses = "font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-accent-ink";

// A date-only string, so format it in UTC to keep the day from shifting.
const updated = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(
  new Date(`${privacy.updated}T00:00:00Z`),
);

export default function PrivacyPage() {
  const { retentionMonths } = privacy;

  // TODO(leadership): approve these promises along with the rest of the page.
  const shortVersion = [
    { icon: <Inbox />, text: "We only ask for what we need to reply to you." },
    { icon: <UserCheck />, text: "Only the leaders who answer messages can see them." },
    { icon: <Clock />, text: `Messages are deleted after ${retentionMonths} months.` },
    { icon: <BadgeX />, text: "We never sell your info or use it for ads." },
  ];

  return (
    <>
      <PageIntro eyebrow="Privacy" title="Your privacy, in plain words.">
        What our forms collect, why we ask, and how long we keep it. No accounts, no fine print.
      </PageIntro>

      <section aria-labelledby="short-title" className="page-x">
        <h2 id="short-title" className="sr-only">
          The short version
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {shortVersion.map((item) => (
            <li key={item.text} className="flex gap-4 rounded-tile bg-surface p-4 ring-1 ring-line ring-inset sm:flex-col sm:p-5">
              <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-on-accent [&_svg]:size-5">
                {item.icon}
              </span>
              <p className="self-center text-pretty font-medium sm:self-start">{item.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="forms-title" className="page-x mt-16 lg:mt-24">
        <SectionHeader id="forms-title" eyebrow="Form by form" title="What each form collects" />
        <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:gap-6">
          {privacy.forms.map((form) => (
            <li key={form.name} className="flex flex-col rounded-card bg-surface p-5 ring-1 ring-line ring-inset sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-display text-h2">{form.name}</h3>
                <Link
                  href={form.href}
                  aria-label={`Go to the ${form.name} form`}
                  className="pressable grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 ring-1 ring-line ring-inset hover:bg-bg"
                >
                  <ArrowUpRight aria-hidden className="size-5" />
                </Link>
              </div>
              <p className="mt-5 text-eyebrow text-muted uppercase">We ask for</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {form.collects.map((field) => (
                  <li key={field} className="rounded-full bg-surface-2 px-3 py-1.5 text-small font-medium ring-1 ring-line ring-inset">
                    {field}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-eyebrow text-muted uppercase">Why</p>
              <p className="mt-1.5 text-pretty">{form.why}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="keep-title" className="page-x mt-16 lg:mt-24">
        <div className="grid items-center gap-6 rounded-card bg-accent p-6 text-on-accent sm:p-10 md:grid-cols-[auto_1fr] md:gap-12 lg:p-14">
          <p aria-hidden className="font-display leading-[0.8] font-extrabold tracking-[-0.05em]">
            <span className="text-[7rem] lg:text-[10rem]">{retentionMonths}</span>
            <span className="ml-2 text-h2 tracking-normal">months</span>
          </p>
          <div>
            <h2 id="keep-title" className="font-display text-h2 text-balance">
              How long we keep it
            </h2>
            <p className="mt-3 max-w-lg text-pretty">
              Messages from every form are deleted {retentionMonths} months after you send them. Want yours gone sooner? Ask
              us, and we&apos;ll delete it.
            </p>
          </div>
        </div>
      </section>

      <section aria-label="More details" className="page-x mt-16 lg:mt-24">
        <div className="border-b border-line">
          {/* TODO(wire-up): true once the forms use Turnstile and the hashed IP rate limit. */}
          <Topic title="Spam protection">
            <p>
              Our forms use Cloudflare Turnstile to check that a person, not a bot, is sending them. It looks at information
              about your browser, under Cloudflare&apos;s own privacy policy.
            </p>
            <p>
              We don&apos;t store your IP address. We keep a scrambled version of it, only to limit how many messages can be
              sent at once.
            </p>
          </Topic>
          <Topic title="Photos">
            <p>
              If there&apos;s a photo of you or your student on this site or our social accounts and you&apos;d like it
              taken down,{" "}
              <Link href="/contact?topic=photo-removal" className={linkClasses}>
                ask us to remove it
              </Link>
              .
            </p>
          </Topic>
          <Topic title="Your choices">
            <p>
              You can ask to see what you&apos;ve sent us, fix it, or have it deleted at any time. There are no accounts on
              this site, so there&apos;s nothing to sign up for or close.
            </p>
          </Topic>
          <Topic title="Questions">
            <p>
              Email{" "}
              <a href={`mailto:${site.email}`} className={linkClasses}>
                {site.email}
              </a>{" "}
              or{" "}
              <Link href="/contact" className={linkClasses}>
                send us a message
              </Link>
              .
            </p>
          </Topic>
        </div>
        <p className="mt-6 text-small text-muted">Last updated {updated}.</p>
      </section>
    </>
  );
}

/** A heading and its text, side by side from `lg`. */
function Topic({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 border-t border-line py-6 lg:grid-cols-[1fr_2fr] lg:gap-12 lg:py-8">
      <h2 className="text-h3">{title}</h2>
      <div className="max-w-2xl space-y-3 text-pretty text-muted">{children}</div>
    </div>
  );
}

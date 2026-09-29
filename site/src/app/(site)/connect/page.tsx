import { ArrowDown, ArrowRight, LockKeyhole } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { JoinForm } from "@/components/forms/join-form";
import { ServeForm } from "@/components/forms/serve-form";
import { PageIntro } from "@/components/site/page-intro";
import { Photo } from "@/components/site/photo";
import { SectionHeader } from "@/components/site/section-header";
import { connect } from "@/content/connect";
import { photos } from "@/content/photos";

export const metadata: Metadata = {
  title: "Connect & Serve",
  description: "Come to a youth night, join the group chat or a small group, and find a team to serve on.",
};

/** A section with its header on the left and a form card on the right from `lg`. */
function FormSection({
  id,
  eyebrow,
  title,
  lede,
  aside,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lede: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="page-x mt-16 scroll-mt-24 lg:mt-24">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12">
        <div className="lg:sticky lg:top-24">
          <SectionHeader id={`${id}-title`} eyebrow={eyebrow} title={title}>
            {lede}
          </SectionHeader>
          {aside}
        </div>
        <div className="rounded-card bg-surface p-5 ring-1 ring-line ring-inset sm:p-8">{children}</div>
      </div>
    </section>
  );
}

export default function ConnectPage() {
  const { steps, smallGroups, join, serve } = connect;

  return (
    <>
      <PageIntro eyebrow="Connect & Serve" title="Come. Connect. Serve.">
        Join a group chat, find your people, and help out on a team.
      </PageIntro>

      <nav aria-label="Three ways in" className="page-x">
        <ol className="grid gap-3 md:grid-cols-3 lg:gap-6">
          {steps.map((step, index) => {
            const onPage = step.href.startsWith("#");
            const Arrow = onPage ? ArrowDown : ArrowRight;
            return (
              <li key={step.id}>
                <Link
                  href={step.href}
                  className={`group pressable flex h-full flex-col justify-between gap-8 rounded-card p-5 sm:p-6 ${
                    index === 0 ? "bg-accent text-on-accent hover:brightness-105" : "bg-surface ring-1 ring-line ring-inset hover:bg-surface-2"
                  }`}
                >
                  <div>
                    <p className={`font-display text-small font-extrabold tabular-nums ${index === 0 ? "" : "text-accent-ink"}`}>
                      0{index + 1}
                    </p>
                    <p className="mt-1 font-display text-[3.25rem] leading-none font-extrabold tracking-[-0.02em] md:text-[2.75rem] lg:text-[4rem]">
                      {step.title}
                    </p>
                    <p className={`mt-3 max-w-xs text-pretty ${index === 0 ? "" : "text-muted"}`}>{step.body}</p>
                  </div>
                  <span className="flex items-center justify-between gap-4 font-semibold">
                    {step.cta}
                    <span
                      aria-hidden
                      className={`grid size-11 place-items-center rounded-full transition-transform duration-200 ease-out-soft motion-reduce:transition-none ${
                        onPage ? "group-hover:translate-y-0.5" : "group-hover:translate-x-0.5"
                      } ${index === 0 ? "bg-on-accent text-accent" : "bg-accent text-on-accent"}`}
                    >
                      <Arrow className="size-5" />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>

      <section aria-labelledby="small-groups-title" className="page-x mt-16 lg:mt-24">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-surface lg:aspect-[4/5]">
            <Photo photo={photos.bibleStudy} seed="small-groups" sizes="(min-width: 1024px) 600px, 100vw" />
          </div>
          <div>
            <SectionHeader id="small-groups-title" eyebrow="Small groups" title={smallGroups.title}>
              {smallGroups.body}
            </SectionHeader>
            <ul className="mt-8 grid gap-6">
              {smallGroups.points.map((point) => (
                <li key={point.title} className="border-t border-line pt-5">
                  <h3 className="text-h3">{point.title}</h3>
                  <p className="mt-1 text-pretty text-muted">{point.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <FormSection
        id="join"
        eyebrow="Connect"
        title={join.title}
        lede={join.body}
        aside={
          <p className="mt-6 flex max-w-md items-start gap-3 rounded-tile bg-surface p-4 text-small text-pretty text-muted ring-1 ring-line ring-inset">
            <LockKeyhole aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-ink" />
            {join.linkNote}
          </p>
        }
      >
        <JoinForm />
      </FormSection>

      <FormSection id="serve" eyebrow="Serve" title={serve.title} lede={serve.body}>
        <ServeForm />
      </FormSection>
    </>
  );
}

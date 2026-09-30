import { ArrowDown, ArrowRight, LockKeyhole } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { JoinForm } from "@/components/forms/join-form";
import { ServeForm } from "@/components/forms/serve-form";
import { PageIntro } from "@/components/site/page-intro";
import { SectionHeader } from "@/components/site/section-header";
import { connect } from "@/content/connect";
import { pages } from "@/content/pages";
import { serveAreas } from "@/content/serve-areas";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata(pages.connect);

/**
 * A section with its header on the left and a form card on the right from
 * `lg`. The card stops at 42rem below `lg` and 48rem from xl, so the fields
 * never run past about 44rem, and from xl up the header takes the rest of
 * the row.
 */
function FormSection({
  id,
  title,
  lede,
  aside,
  children,
}: {
  id: string;
  title: string;
  lede: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="page-x mt-16 scroll-mt-24 lg:mt-24">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_min(48rem,60%)]">
        <div className="lg:sticky lg:top-24">
          <SectionHeader id={`${id}-title`} title={title}>
            {lede}
          </SectionHeader>
          {aside}
        </div>
        <div className="max-w-2xl rounded-card bg-surface p-5 ring-1 ring-line ring-inset sm:p-8 lg:max-w-none">{children}</div>
      </div>
    </section>
  );
}

export default function ConnectPage() {
  const { steps, join, serve } = connect;

  return (
    <>
      <PageIntro title={pages.connect.heading}>
        Keep coming, get in the group chat, and find a place to serve.
      </PageIntro>

      <nav aria-label="Three ways in" className="page-x">
        {/* Cards until xl, then one band between hairlines with big numbers. */}
        <ol className="grid gap-3 md:grid-cols-3 lg:gap-6 xl:gap-0 xl:divide-x xl:divide-line xl:border-y xl:border-line">
          {steps.map((step, index) => {
            const onPage = step.href.startsWith("#");
            const Arrow = onPage ? ArrowDown : ArrowRight;
            return (
              <li key={step.id} className="xl:px-(--grid-gap) xl:first:pl-0 xl:last:pr-0">
                <Link
                  href={step.href}
                  className={`group pressable flex h-full flex-col justify-between gap-8 rounded-card p-5 sm:p-6 xl:rounded-none xl:bg-transparent xl:px-0 xl:py-12 xl:text-fg xl:ring-0 xl:hover:bg-transparent xl:hover:brightness-100 ${
                    index === 0 ? "bg-accent text-on-accent hover:brightness-105" : "bg-surface ring-1 ring-line ring-inset hover:bg-surface-2"
                  }`}
                >
                  <div>
                    <p
                      className={`font-display text-small font-extrabold tabular-nums xl:text-[clamp(5rem,7vw,9rem)] xl:leading-[0.85] xl:tracking-[-0.04em] xl:text-accent-ink ${index === 0 ? "" : "text-accent-ink"}`}
                    >
                      0{index + 1}
                    </p>
                    <p className="mt-1 font-display text-[3.25rem] leading-none font-extrabold tracking-[-0.02em] md:text-[2.75rem] lg:text-[4rem]">
                      {step.title}
                    </p>
                    <p className={`mt-3 max-w-xs text-pretty xl:text-muted ${index === 0 ? "" : "text-muted"}`}>{step.body}</p>
                  </div>
                  <span className="flex items-center justify-between gap-4 font-semibold">
                    {step.cta}
                    <span
                      aria-hidden
                      className={`grid size-11 place-items-center rounded-full transition-transform duration-200 ease-out-soft motion-reduce:transition-none ${
                        onPage ? "group-hover:translate-y-0.5" : "group-hover:translate-x-0.5"
                      } ${index === 0 ? "bg-on-accent text-accent xl:bg-accent xl:text-on-accent" : "bg-accent text-on-accent"}`}
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

      <FormSection
        id="join"
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

      <FormSection
        id="serve"
        title={serve.title}
        lede={serve.body}
        aside={
          <ul className="mt-6 max-w-md divide-y divide-line border-y border-line xl:grid xl:max-w-none xl:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] xl:gap-x-(--grid-gap) xl:divide-y-0 xl:border-y-0">
            {serveAreas.map((area) => (
              <li key={area.id} className="py-3.5 xl:border-t xl:border-line xl:pb-6">
                <h3 className="font-semibold">{area.title}</h3>
                <p className="text-small text-pretty text-muted">{area.body}</p>
              </li>
            ))}
          </ul>
        }
      >
        <ServeForm />
      </FormSection>
    </>
  );
}

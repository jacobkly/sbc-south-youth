import type { Metadata } from "next";
import { ButtonLink } from "@/components/button";
import { SiteShell } from "@/components/site/site-shell";

export const metadata: Metadata = { title: "Page not found" };

// Renders under the root layout only, so it brings its own site chrome.
export default function NotFound() {
  return (
    <SiteShell>
      <div className="page-x flex min-h-[60dvh] flex-col justify-center py-12">
        <p className="text-eyebrow text-accent-ink uppercase">Page not found</p>
        <h1 className="mt-3 font-display text-display">Wrong room.</h1>
        <p className="mt-4 max-w-md text-pretty text-muted">
          This page moved or never existed. Here&apos;s where most people are headed.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/">Home</ButtonLink>
          <ButtonLink href="/this-week" variant="secondary">
            This week
          </ButtonLink>
          <ButtonLink href="/visit" variant="secondary">
            Plan a visit
          </ButtonLink>
        </div>
      </div>
    </SiteShell>
  );
}

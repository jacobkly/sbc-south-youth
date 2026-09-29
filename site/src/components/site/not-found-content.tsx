import { ButtonLink } from "@/components/button";

/** The "Wrong room." page body, with links to where most people are headed. */
export function NotFoundContent() {
  return (
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
  );
}

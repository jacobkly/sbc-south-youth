import { ButtonLink } from "@/components/button";

/** The "Page not found" body, with links to where most people are headed. */
export function NotFoundContent() {
  return (
    <div className="page-x flex min-h-[60dvh] flex-col justify-center py-12">
      <h1 className="font-display text-display">Page not found</h1>
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

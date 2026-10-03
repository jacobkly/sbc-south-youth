import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BlockedSection } from "@/components/portal/email/blocked-section";
import { EmailListSkeleton, RecentProblems } from "@/components/portal/email/email-problems";
import { EmailHeader, EmailUsageSections, EmailUsageSkeleton } from "@/components/portal/email/email-usage";
import { NarrowPage } from "@/components/portal/nav/app-shell";
import { getCurrentUser } from "@/lib/portal/auth/current-user";

export const metadata: Metadata = {
  title: "Email",
};

export default async function EmailPage() {
  // Only owners see how email is used. RLS and email_summary() check again.
  const me = await getCurrentUser();
  if (!me?.roles.includes("owner")) notFound();

  return (
    <NarrowPage className="space-y-8">
      <EmailHeader />

      <Suspense fallback={<EmailUsageSkeleton />}>
        <EmailUsageSections />
      </Suspense>

      <section aria-labelledby="problems-heading" className="space-y-3">
        <div className="space-y-1">
          <h2 id="problems-heading" className="text-lg font-semibold">
            Recent problems
          </h2>
          <p className="text-sm text-muted-foreground">The newest emails that failed, bounced, or were marked as spam.</p>
        </div>
        <Suspense fallback={<EmailListSkeleton label="Loading recent problems" />}>
          <RecentProblems />
        </Suspense>
      </section>

      <section aria-labelledby="blocked-heading" className="space-y-3">
        <div className="space-y-1">
          <h2 id="blocked-heading" className="text-lg font-semibold">
            Blocked addresses
          </h2>
          <p className="text-sm text-muted-foreground">
            Nothing is sent to an address that bounced or was marked as spam. Unblock one once it&apos;s fixed.
          </p>
        </div>
        <Suspense fallback={<EmailListSkeleton label="Loading blocked addresses" />}>
          <BlockedSection />
        </Suspense>
      </section>
    </NarrowPage>
  );
}

import { EmailListSkeleton } from "@/components/portal/email/email-problems";
import { EmailHeader, EmailUsageSkeleton } from "@/components/portal/email/email-usage";
import { NarrowPage } from "@/components/portal/nav/app-shell";

// Shown at once when an owner opens Email from another portal page.
export default function EmailLoading() {
  return (
    <NarrowPage className="space-y-8">
      <EmailHeader />
      <EmailUsageSkeleton />
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Recent problems</h2>
        <EmailListSkeleton label="Loading recent problems" />
      </div>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Blocked addresses</h2>
        <EmailListSkeleton label="Loading blocked addresses" />
      </div>
    </NarrowPage>
  );
}

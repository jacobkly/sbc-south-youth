import { EmailListSkeleton } from "@/components/portal/email/email-problems";
import { EmailHeader, EmailUsageSkeleton } from "@/components/portal/email/email-usage";

// Shown at once when an owner opens Email from another portal page.
export default function EmailLoading() {
  return (
    <div className="space-y-8">
      <EmailHeader />
      <div className="grid grid-cols-1 gap-8 @4xl/main:grid-cols-2 @4xl/main:items-start">
        <EmailUsageSkeleton />
        <div className="space-y-8">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Recent problems</h2>
            <EmailListSkeleton label="Loading recent problems" />
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Blocked addresses</h2>
            <EmailListSkeleton label="Loading blocked addresses" />
          </div>
        </div>
      </div>
    </div>
  );
}

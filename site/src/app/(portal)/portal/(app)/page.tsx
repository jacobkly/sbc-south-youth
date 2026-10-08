import { Suspense } from "react";
import { ArrowRightIcon, ReceiptTextIcon } from "lucide-react";
import { BackupStatusSkeleton, HomeBackup } from "@/components/portal/home/backup-status";
import { HomeEmailAlert } from "@/components/portal/home/email-alert";
import { ErrorsCardSkeleton, HomeErrors } from "@/components/portal/home/errors-card";
import { HomeHeadcount } from "@/components/portal/home/headcount-card";
import { HomeMessages } from "@/components/portal/home/messages-card";
import { HomeStorage, StorageBarSkeleton } from "@/components/portal/home/storage-bar";
import { Button } from "@/components/portal/ui/button";
import { readPortalEnv } from "@/lib/env";
import { getCurrentUser } from "@/lib/portal/auth/current-user";
import { canUseFinances, hasRole, ROLE_DESCRIPTIONS, ROLE_LABELS, sortRoles } from "@/lib/portal/roles";

export default async function PortalHome() {
  // The layout already checked access, so this is an active person with a portal role.
  const user = await getCurrentUser();
  if (!user) return null;

  const firstName = user.full_name.trim().split(/\s+/)[0];
  // An owner's one role covers the rest, so list it alone.
  const isOwner = user.roles.includes("owner");
  const roles = isOwner ? (["owner"] as const) : sortRoles(user.roles);
  const financesUrl = canUseFinances(user.roles) ? readPortalEnv().financesUrl : null;
  const messages = hasRole(user.roles, "site_messages");
  const headcount = hasRole(user.roles, "attendance", "finance_viewer");
  // storage_summary() leaves out the Attendance role, which has nothing to upload.
  const storage = hasRole(user.roles, "finance_viewer", "site_editor", "site_messages");
  // On a PC, what needs doing and what this person can do go on the left,
  // and how the plan and the nightly jobs are doing on the right. Someone
  // with only one of those has it on the left and their access on the right.
  const toDo = isOwner || messages || headcount || financesUrl !== null;
  const sideBySide = toDo && (storage || isOwner);

  const health = (
    <>
      {storage && (
        <section aria-labelledby="storage-heading" className="space-y-3">
          <div className="space-y-1">
            <h2 id="storage-heading" className="text-lg font-semibold">
              Storage
            </h2>
            <p className="text-sm text-muted-foreground">
              The free plan&apos;s space for files and data, shared by the site and finances.
            </p>
          </div>
          <Suspense fallback={<StorageBarSkeleton />}>
            <HomeStorage />
          </Suspense>
        </section>
      )}

      {isOwner && (
        <section aria-labelledby="backup-heading" className="space-y-3">
          <div className="space-y-1">
            <h2 id="backup-heading" className="text-lg font-semibold">
              Backups
            </h2>
            <p className="text-sm text-muted-foreground">A copy of the database and files, made each night.</p>
          </div>
          <Suspense fallback={<BackupStatusSkeleton />}>
            <HomeBackup />
          </Suspense>
        </section>
      )}

      {isOwner && (
        <section aria-labelledby="errors-heading" className="space-y-3">
          <div className="space-y-1">
            <h2 id="errors-heading" className="text-lg font-semibold">
              Errors
            </h2>
            <p className="text-sm text-muted-foreground">
              Problems the site and portal ran into. Each stays here for 30 days.
            </p>
          </div>
          <Suspense fallback={<ErrorsCardSkeleton />}>
            <HomeErrors />
          </Suspense>
        </section>
      )}
    </>
  );

  // Last on a phone, wherever it sits on a PC.
  const access = (
    <section aria-labelledby="access-heading" className="order-last space-y-3">
      <h2 id="access-heading" className="text-lg font-semibold">
        Your access
      </h2>
      <ul className="divide-y rounded-xl border bg-card">
        {roles.map((role) => (
          <li key={role} className="space-y-0.5 p-4">
            <p className="font-medium">{ROLE_LABELS[role]}</p>
            <p className="text-sm text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{firstName ? `Hi, ${firstName}` : "Welcome"}</h1>
        <p className="text-muted-foreground">This is where leaders keep the youth site and its people up to date.</p>
      </header>

      {/* On a phone the columns don't draw a box, so their sections stack in one list. */}
      <div className="grid grid-cols-1 gap-8 @4xl/main:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] @4xl/main:items-start">
        <div className="contents @4xl/main:block @4xl/main:space-y-8">
          {isOwner && (
            <Suspense fallback={null}>
              <HomeEmailAlert />
            </Suspense>
          )}

          {messages && <HomeMessages />}

          {headcount && <HomeHeadcount />}

          {financesUrl && (
            <section
              aria-labelledby="finances-heading"
              className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted" aria-hidden>
                <ReceiptTextIcon className="size-5 text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <h2 id="finances-heading" className="font-semibold">
                  Finances
                </h2>
                <p className="text-sm text-muted-foreground">Reimbursements, receipts, and reports.</p>
              </div>
              <Button asChild variant="outline" className="h-11 px-5">
                <a href={financesUrl}>
                  Open finances
                  <ArrowRightIcon aria-hidden />
                </a>
              </Button>
            </section>
          )}

          {!toDo && health}
          {sideBySide && access}
        </div>

        <div className="contents @4xl/main:block @4xl/main:space-y-8">{sideBySide ? health : access}</div>
      </div>
    </div>
  );
}

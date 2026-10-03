import { CircleAlertIcon, MailCheckIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "cn";
import { Skeleton } from "@/components/portal/ui/skeleton";
import { formatWeekdayDate, laDateOf } from "@/lib/dates";
import { reportPortalError } from "@/lib/portal/errors";
import type { UsageLevel } from "@/lib/portal/home/storage";
import { loadEmailOverview } from "@/lib/portal/email/queries";
import type { EmailOverview, EmailUsage, TemplateRow } from "@/lib/portal/email/summary";

const METER_COLORS: Record<UsageLevel, string> = {
  ok: "bg-primary",
  warning: "bg-amber-500",
  critical: "bg-red-600 dark:bg-red-500",
};

const LEVEL_TEXT: Record<UsageLevel, string> = {
  ok: "text-muted-foreground",
  warning: "text-amber-800 dark:text-amber-200",
  critical: "text-red-700 dark:text-red-300",
};

const count = new Intl.NumberFormat("en-US");

/** One limit: what's counted, out of what, and a meter that turns amber at 80% and red at 95%. */
function Meter({ label, usage }: { label: string; usage: EmailUsage }) {
  const used = count.format(usage.used);
  const limit = count.format(usage.limit);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0">
          <span className="text-xl font-semibold tabular-nums">{used}</span>{" "}
          <span className="text-sm text-muted-foreground">
            of {limit} in the {label}
          </span>
        </p>
        <p className={cn("shrink-0 text-sm tabular-nums", LEVEL_TEXT[usage.level])}>{usage.percent}%</p>
      </div>
      <div
        role="meter"
        aria-label={`Emails in the ${label}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(usage.percent, 100)}
        aria-valuetext={`${usage.percent}%, ${used} of ${limit}`}
        className="h-2.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full", METER_COLORS[usage.level])}
          style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Today's and this month's emails against Resend's free plan, what the
 * limits are holding back, and whether owners were warned this month.
 */
export function EmailQuota({ overview }: { overview: EmailOverview }) {
  const { day, month, note, warnedAt } = overview;
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <Meter label="last 24 hours" usage={day} />
      <Meter label="last 31 days" usage={month} />

      {note && (
        <p className={cn("flex items-start gap-2 text-sm", LEVEL_TEXT[note.level])}>
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {note.text}
        </p>
      )}

      <div className="space-y-1.5 border-t pt-3 text-sm text-muted-foreground">
        <p>
          Resend doesn&apos;t say when its day or month starts, so these count back from now. Sign-in codes get the
          last of the room, so nobody gets locked out.
        </p>
        {warnedAt && (
          <p>
            Owners got this month&apos;s warning email on{" "}
            <time dateTime={warnedAt}>{formatWeekdayDate(laDateOf(warnedAt))}</time>.
          </p>
        )}
      </div>
    </div>
  );
}

/** What each kind of email sent in the last 31 days, busiest first, with anything that went wrong. */
export function EmailTemplates({ templates }: { templates: TemplateRow[] }) {
  if (templates.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm">
        <MailCheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-muted-foreground">Nothing has been sent in the last 31 days.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {templates.map((row) => (
        <li key={row.template} className="flex items-start justify-between gap-4 px-4 py-3">
          <div className="min-w-0 space-y-0.5">
            <p className="font-medium break-words">{row.label}</p>
            {row.problems.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {row.problems
                  .map((problem) => `${count.format(problem.emails)} ${problem.label.toLowerCase()}`)
                  .join(" · ")}
              </p>
            )}
          </div>
          <p className="shrink-0 text-right">
            <span className="font-medium tabular-nums">{count.format(row.sent)}</span>{" "}
            <span className="text-sm text-muted-foreground">sent</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

/** The screen's heading, shared with its loading screen. */
export function EmailHeader() {
  return (
    <header className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">Email</h1>
      <p className="text-muted-foreground">
        Everything the portal, finances, and the site send, out of Resend&apos;s free 100 a day and 3,000 a month.
      </p>
    </header>
  );
}

export function EmailUsageSkeleton() {
  return (
    <div className="space-y-8">
      <EmailQuotaSkeleton />
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">By kind</h2>
        <EmailTemplatesSkeleton />
      </div>
    </div>
  );
}

export function EmailQuotaSkeleton() {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4" aria-busy="true" aria-label="Loading email use">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-2.5 w-full rounded-full" />
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-2.5 w-full rounded-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export function EmailTemplatesSkeleton() {
  return (
    <div className="divide-y rounded-xl border bg-card" aria-busy="true" aria-label="Loading emails by kind">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center justify-between gap-4 px-4 py-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-14" />
        </div>
      ))}
    </div>
  );
}

export function SectionError({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm">
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}

/** Loads the counts as the owner. A failure only hides these two sections, not the rest of the screen. */
export async function EmailUsageSections() {
  let overview: EmailOverview;
  try {
    overview = await loadEmailOverview();
  } catch (error) {
    await reportPortalError("Email use", error);
    return <SectionError text="Email use couldn't load. Refresh the page to try again." />;
  }

  return (
    <div className="space-y-8">
      <EmailQuota overview={overview} />
      <section aria-labelledby="templates-heading" className="space-y-3">
        <div className="space-y-1">
          <h2 id="templates-heading" className="text-lg font-semibold">
            By kind
          </h2>
          <p className="text-sm text-muted-foreground">The last 31 days. Bounced emails still count as sent.</p>
        </div>
        <EmailTemplates templates={overview.templates} />
      </section>
    </div>
  );
}

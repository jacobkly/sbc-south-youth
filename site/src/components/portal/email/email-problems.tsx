import { CircleCheckIcon } from "lucide-react";
import { Badge } from "@/components/portal/ui/badge";
import { Skeleton } from "@/components/portal/ui/skeleton";
import { formatDayLabel, formatTime, laDateOf } from "@/lib/dates";
import { loadEmailProblems, type EmailProblem } from "@/lib/portal/email/queries";
import { PROBLEMS, templateLabel } from "@/lib/portal/email/summary";
import { reportPortalError } from "@/lib/portal/errors";
import { SectionError } from "./email-usage";

const STATUS_LABELS = Object.fromEntries(PROBLEMS.map(({ status, label }) => [status, label])) as Record<
  EmailProblem["status"],
  string
>;

/** The newest emails that failed, bounced or were marked as spam, with Resend's reason when it gave one. */
export function EmailProblems({ problems }: { problems: EmailProblem[] }) {
  if (problems.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm">
        <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <p className="text-muted-foreground">No failures, bounces, or spam reports in the last 31 days.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {problems.map((problem) => (
        <li key={problem.id} className="space-y-1 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={problem.status === "failed" ? "outline" : "destructive"}>
              {STATUS_LABELS[problem.status]}
            </Badge>
            {problem.env === "staging" && <Badge variant="secondary">Staging</Badge>}
            <p className="font-medium">{templateLabel(problem.template)}</p>
          </div>
          <p className="text-sm break-all text-muted-foreground">{problem.toAddress ?? "Address cleared"}</p>
          {problem.error && <p className="line-clamp-3 text-sm break-words">{problem.error}</p>}
          <p className="text-sm text-muted-foreground">
            <time dateTime={problem.createdAt}>
              {formatDayLabel(laDateOf(problem.createdAt))} at {formatTime(problem.createdAt)}
            </time>
          </p>
        </li>
      ))}
    </ul>
  );
}

export function EmailListSkeleton({ label }: { label: string }) {
  return (
    <div className="divide-y rounded-xl border bg-card" aria-busy="true" aria-label={label}>
      {[0, 1].map((row) => (
        <div key={row} className="space-y-2 px-4 py-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      ))}
    </div>
  );
}

/** Loads the newest problems as the owner. A failure only hides this section. */
export async function RecentProblems() {
  let problems: EmailProblem[];
  try {
    problems = await loadEmailProblems();
  } catch (error) {
    await reportPortalError("Email problems", error);
    return <SectionError text="Recent problems couldn't load. Refresh the page to try again." />;
  }
  return <EmailProblems problems={problems} />;
}

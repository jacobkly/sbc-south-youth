import { CircleCheckIcon } from "lucide-react";
import { LoadError } from "@/components/portal/load-error";
import { Badge } from "@/components/portal/ui/badge";
import { Skeleton } from "@/components/portal/ui/skeleton";
import { reportPortalError } from "@/lib/portal/errors";
import { ERROR_DAYS, type ErrorsOverview } from "@/lib/portal/home/errors";
import { loadErrors } from "@/lib/portal/home/queries";

/**
 * The newest errors on an owner's Home: where each happened, what it said,
 * when, and who hit it. Repeats show once with how many times.
 */
export function ErrorsCard({ overview }: { overview: ErrorsOverview }) {
  if (overview.groups.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm">
        <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <p className="text-muted-foreground">No errors in the last {ERROR_DAYS} days.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="divide-y rounded-xl border bg-card">
        {overview.groups.map((group) => (
          <li key={group.id} className="space-y-1 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium break-words">{group.source}</p>
              {group.times > 1 && <Badge variant="outline">{group.times} times</Badge>}
              {group.staging && <Badge variant="secondary">Staging</Badge>}
            </div>
            <p className="line-clamp-3 text-sm break-words">{group.message}</p>
            <p className="text-sm text-muted-foreground">
              <time dateTime={group.at}>{group.when}</time>
              {group.who && <> · {group.who}</>}
              {group.code && (
                <>
                  {" · "}
                  <code className="font-mono text-xs">{group.code}</code>
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
      {overview.note && <p className="text-sm text-muted-foreground">{overview.note}</p>}
    </div>
  );
}

export function ErrorsCardSkeleton() {
  return (
    <div className="divide-y rounded-xl border bg-card" aria-busy="true" aria-label="Loading errors">
      {[0, 1].map((row) => (
        <div key={row} className="space-y-2 px-4 py-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64 max-w-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  );
}

/** Loads the newest errors as the signed-in owner. A failure only hides this list, not the rest of Home. */
export async function HomeErrors() {
  let overview: ErrorsOverview;
  try {
    overview = await loadErrors();
  } catch (error) {
    await reportPortalError("Home errors", error);
    return <LoadError text="Errors couldn't load." />;
  }
  return <ErrorsCard overview={overview} />;
}

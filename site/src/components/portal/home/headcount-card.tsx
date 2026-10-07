import Link from "next/link";
import { Suspense } from "react";
import { ArrowRightIcon, Tally5Icon } from "lucide-react";
import { Button } from "@/components/portal/ui/button";
import { Skeleton } from "@/components/portal/ui/skeleton";
import { todayInLA } from "@/lib/dates";
import { latestText } from "@/lib/portal/attendance/headcount";
import { loadHeadcounts } from "@/lib/portal/attendance/queries";
import { reportPortalError } from "@/lib/portal/errors";

async function LatestCount() {
  let text: string;
  try {
    text = latestText(await loadHeadcounts(1), todayInLA());
  } catch (error) {
    await reportPortalError("Home attendance", error);
    text = "The latest count couldn't load.";
  }
  return <>{text}</>;
}

/** Attendance on Home, for the Attendance role and finance viewers, with the newest night's count. */
export function HomeHeadcount() {
  return (
    <section
      aria-labelledby="attendance-heading"
      className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted" aria-hidden>
        <Tally5Icon className="size-5 text-muted-foreground" />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <h2 id="attendance-heading" className="font-semibold">
          Attendance
        </h2>
        <div className="text-sm text-muted-foreground">
          <Suspense fallback={<Skeleton className="mt-0.5 h-4 w-36" />}>
            <LatestCount />
          </Suspense>
        </div>
      </div>
      <Button asChild variant="outline" className="h-11 px-5">
        <Link href="/attendance">
          Open attendance
          <ArrowRightIcon aria-hidden />
        </Link>
      </Button>
    </section>
  );
}

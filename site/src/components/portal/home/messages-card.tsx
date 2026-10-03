import Link from "next/link";
import { Suspense } from "react";
import { ArrowRightIcon, InboxIcon } from "lucide-react";
import { Button } from "@/components/portal/ui/button";
import { Skeleton } from "@/components/portal/ui/skeleton";
import { newMessagesText } from "@/lib/portal/messages/list";
import { loadNewMessageCount } from "@/lib/portal/messages/queries";

async function NewMessages() {
  return <>{newMessagesText(await loadNewMessageCount())}</>;
}

/** Messages on Home, for people with the role, with how many are new. */
export function HomeMessages() {
  return (
    <section
      aria-labelledby="messages-heading"
      className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted" aria-hidden>
        <InboxIcon className="size-5 text-muted-foreground" />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <h2 id="messages-heading" className="font-semibold">
          Messages
        </h2>
        <div className="text-sm text-muted-foreground">
          <Suspense fallback={<Skeleton className="mt-0.5 h-4 w-44" />}>
            <NewMessages />
          </Suspense>
        </div>
      </div>
      <Button asChild variant="outline" className="h-11 px-5">
        <Link href="/messages">
          Open messages
          <ArrowRightIcon aria-hidden />
        </Link>
      </Button>
    </section>
  );
}

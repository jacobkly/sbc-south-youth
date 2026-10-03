import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlusIcon, PlusIcon } from "lucide-react";
import { EventSection } from "@/components/portal/events/event-list";
import { NarrowPage } from "@/components/portal/nav/app-shell";
import { PostKinds } from "@/components/portal/posts/post-kinds";
import { Button } from "@/components/portal/ui/button";
import { getCurrentUser } from "@/lib/portal/auth/current-user";
import { groupEvents } from "@/lib/portal/events/list";
import { loadEvents, PAST_LIMIT } from "@/lib/portal/events/queries";
import { hasRole } from "@/lib/portal/roles";

export const metadata: Metadata = {
  title: "Events",
};

export default async function EventsPage() {
  // Site editors and owners. RLS keeps everyone else from reading events anyway.
  const me = await getCurrentUser();
  if (!me || !hasRole(me.roles, "site_editor")) notFound();

  const now = new Date();
  const { current, past } = await loadEvents(now);
  const groups = groupEvents([...current, ...past], now);

  return (
    <NarrowPage className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Posts</h1>
          <p className="text-muted-foreground">Events on This Week, their own pages, and calendars.</p>
        </div>
        <Button asChild className="h-11 shrink-0 px-5">
          <Link href="/events/new">
            <PlusIcon aria-hidden />
            New
          </Link>
        </Button>
      </header>

      <PostKinds current="/events" />

      {current.length === 0 && (
        <section aria-labelledby="empty-heading" className="space-y-3 rounded-xl border border-dashed p-6 text-center">
          <CalendarPlusIcon className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <h2 id="empty-heading" className="font-semibold">
              Nothing coming up
            </h2>
            <p className="text-sm text-balance text-muted-foreground">
              Add a retreat, a game night, or anything past the usual weekly nights. It gets its own page, shows on
              This Week, and lands in calendars that subscribe.
            </p>
          </div>
          <Button asChild variant="outline" className="h-11 px-5">
            <Link href="/events/new">Add an event</Link>
          </Button>
        </section>
      )}

      <EventSection
        id="coming"
        title="Coming up"
        description="On This Week and in calendars, soonest first. Cancelled ones keep their page with a banner."
        events={groups.coming}
        now={now}
      />
      <EventSection
        id="drafts"
        title="Drafts"
        description="Only leaders see these until they're published."
        events={groups.draft}
        now={now}
      />
      <EventSection
        id="past"
        title="Past"
        description={`The last ${PAST_LIMIT}. Open one to make a new one like it.`}
        events={groups.past}
        now={now}
      />
    </NarrowPage>
  );
}

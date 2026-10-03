import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { EventForm } from "@/components/portal/events/event-form";
import { NarrowPage } from "@/components/portal/nav/app-shell";
import { Button } from "@/components/portal/ui/button";
import { readPortalEnv } from "@/lib/env";
import { publicSiteUrl } from "@/lib/host";
import { getCurrentUser } from "@/lib/portal/auth/current-user";
import { loadEvent } from "@/lib/portal/events/queries";
import { copyValues, formValues } from "@/lib/portal/events/save";
import { hasRole } from "@/lib/portal/roles";

export const metadata: Metadata = {
  title: "New event",
};

export default async function NewEventPage({ searchParams }: PageProps<"/portal/events/new">) {
  // The action checks again, and RLS checks after it.
  const me = await getCurrentUser();
  if (!me || !hasRole(me.roles, "site_editor")) notFound();

  // A new one like another starts from its words, place, and times.
  const { from } = await searchParams;
  const source = typeof from === "string" ? await loadEvent(from) : null;

  const env = readPortalEnv();

  return (
    <NarrowPage className="space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" className="-ml-3 h-11 px-3 text-muted-foreground" asChild>
          <Link href="/events">
            <ChevronLeftIcon aria-hidden />
            Events
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{source ? "New event like it" : "New event"}</h1>
        <p className="text-muted-foreground">
          {source
            ? `The same details as ${source.title}. Pick the days, then publish.`
            : "It gets its own page, shows on This Week, and lands in calendars that subscribe."}
        </p>
      </div>

      <EventForm
        id={null}
        initial={source ? copyValues(source) : formValues(null)}
        state={null}
        slug={null}
        nowIso={new Date().toISOString()}
        siteUrl={publicSiteUrl(env.portalUrl)}
        copied={source !== null}
        // Staging shares production's data, so it doesn't change events.
        readOnly={env.appEnv === "staging"}
      />
    </NarrowPage>
  );
}

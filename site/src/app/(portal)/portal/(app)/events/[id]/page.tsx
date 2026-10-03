import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRightIcon, ChevronLeftIcon, CopyPlusIcon } from "lucide-react";
import { EventActions } from "@/components/portal/events/event-actions";
import { EventForm } from "@/components/portal/events/event-form";
import { NarrowPage } from "@/components/portal/nav/app-shell";
import { PastHeading } from "@/components/portal/posts/past-heading";
import { Badge } from "@/components/portal/ui/badge";
import { Button } from "@/components/portal/ui/button";
import { todayInLA } from "@/lib/dates";
import { readPortalEnv } from "@/lib/env";
import { publicSiteUrl } from "@/lib/host";
import { getCurrentUser } from "@/lib/portal/auth/current-user";
import { eventState, STATE_LABELS, whenLabel, type EventRow } from "@/lib/portal/events/list";
import { loadEvent } from "@/lib/portal/events/queries";
import { formValues } from "@/lib/portal/events/save";
import { hasRole } from "@/lib/portal/roles";

const BADGES = {
  draft: "outline",
  upcoming: "default",
  happening: "default",
  cancelled: "destructive",
  past: "outline",
} as const;

export async function generateMetadata({ params }: PageProps<"/portal/events/[id]">): Promise<Metadata> {
  const me = await getCurrentUser();
  if (!me || !hasRole(me.roles, "site_editor")) return { title: "Events" };
  const event = await loadEvent((await params).id);
  return { title: event?.title ?? "Events" };
}

export default async function EventPage({ params }: PageProps<"/portal/events/[id]">) {
  // The actions check again, and RLS checks after them.
  const me = await getCurrentUser();
  if (!me || !hasRole(me.roles, "site_editor")) notFound();
  const event = await loadEvent((await params).id);
  if (!event) notFound();

  const now = new Date();
  const state = eventState(event, now);
  const env = readPortalEnv();
  const siteUrl = publicSiteUrl(env.portalUrl);
  // Staging shares production's data, so it doesn't change events.
  const readOnly = env.appEnv === "staging";
  // A cancelled or past event stays as it was. Changing one starts from putting it back on, or a copy.
  const editable = state === "draft" || state === "upcoming" || state === "happening";
  const when = whenLabel(event, todayInLA(now));

  // The parts keep their places whatever the state, so the actions keep their message after cancelling.
  return (
    <NarrowPage className="space-y-8">
      <div className="space-y-2">
        <div>
          <Button variant="ghost" className="-ml-3 h-11 px-3 text-muted-foreground" asChild>
            <Link href="/events">
              <ChevronLeftIcon aria-hidden />
              Events
            </Link>
          </Button>
        </div>
        {editable ? (
          <h1 className="text-2xl font-semibold tracking-tight">Edit event</h1>
        ) : (
          <PastHeading>{event.title}</PastHeading>
        )}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
          <Badge variant={BADGES[state]}>{STATE_LABELS[state]}</Badge>
          <span>
            {when}.{state === "draft" && " Only leaders see it until it's published."}
          </span>
        </p>
        {state !== "draft" && (
          <p>
            <a
              href={`${siteUrl}/events/${event.slug}`}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-medium underline underline-offset-4"
            >
              See it on the site
              <ArrowUpRightIcon className="size-4" aria-hidden />
            </a>
          </p>
        )}
      </div>

      {editable ? (
        <EventForm
          id={event.id}
          initial={formValues(event)}
          state={state}
          slug={state === "draft" ? null : event.slug}
          nowIso={now.toISOString()}
          siteUrl={siteUrl}
          copied={false}
          readOnly={readOnly}
        />
      ) : (
        <EventDetails event={event} />
      )}

      {state !== "past" && <EventActions id={event.id} state={state} readOnly={readOnly} />}

      {!editable && (
        <div className="space-y-2">
          <Button asChild variant={state === "past" ? "default" : "outline"} className="h-11 px-6">
            <Link href={`/events/new?from=${event.id}`}>
              <CopyPlusIcon aria-hidden />
              Make a new one like it
            </Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            Starts a new event with the same details. You pick the days and can change anything first.
          </p>
        </div>
      )}
    </NarrowPage>
  );
}

/** A cancelled or past event, as it was. */
function EventDetails({ event }: { event: EventRow }) {
  const place = [event.location_name, event.address].filter(Boolean).join(", ");
  return (
    <div className="space-y-4">
      {event.status === "cancelled" && (
        <div className="space-y-1 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">Cancelled</p>
          <p className="text-sm">{event.cancel_reason ?? "No reason given. The site just says it's cancelled."}</p>
        </div>
      )}
      <dl className="divide-y overflow-hidden rounded-xl border bg-card">
        {place && <Detail label="Where">{place}</Detail>}
        {event.cost_note && <Detail label="Cost">{event.cost_note}</Detail>}
        {event.summary && <Detail label="Short description">{event.summary}</Detail>}
        {event.body && (
          <Detail label="Details">
            <span className="whitespace-pre-line">{event.body}</span>
          </Detail>
        )}
        <Detail label="Featured">{event.featured ? "Yes" : "No"}</Detail>
      </dl>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5 px-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

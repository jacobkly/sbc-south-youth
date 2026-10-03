import Link from "next/link";
import { CalendarXIcon, ChevronRightIcon, RadioIcon, StarIcon } from "lucide-react";
import { Badge } from "@/components/portal/ui/badge";
import { todayInLA } from "@/lib/dates";
import { eventState, whenLabel, type EventRow } from "@/lib/portal/events/list";

const ROW =
  "flex min-w-0 items-start gap-3 p-4 outline-none hover:bg-muted/50 " +
  "focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset";

/** What sets an event apart: called off, going on now, or featured. */
export function EventBadges({
  event,
  now,
}: {
  event: Pick<EventRow, "status" | "starts_at" | "ends_at" | "featured">;
  now: Date;
}) {
  const state = eventState(event, now);
  // A past event's badges would only describe what it was.
  if (state === "past" || (state !== "cancelled" && state !== "happening" && !event.featured)) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {state === "cancelled" && (
        <Badge variant="destructive">
          <CalendarXIcon aria-hidden />
          Cancelled
        </Badge>
      )}
      {state === "happening" && (
        <Badge>
          <RadioIcon aria-hidden />
          Happening now
        </Badge>
      )}
      {event.featured && state !== "cancelled" && (
        <Badge variant="secondary">
          <StarIcon aria-hidden />
          Featured
        </Badge>
      )}
    </div>
  );
}

/** One group of events, each opening its own page. Nothing at all when the group is empty. */
export function EventSection({
  id,
  title,
  description,
  events,
  now,
}: {
  id: string;
  title: string;
  description: string;
  events: EventRow[];
  now: Date;
}) {
  if (events.length === 0) return null;
  const today = todayInLA(now);
  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-3">
      <div className="space-y-1">
        <h2 id={`${id}-heading`} className="flex items-baseline gap-2 text-lg font-semibold">
          {title}
          <span className="text-sm font-normal text-muted-foreground">{events.length}</span>
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {events.map((event) => (
          <li key={event.id}>
            <Link href={`/events/${event.id}`} className={ROW}>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="line-clamp-2 font-medium text-pretty">{event.title}</p>
                <p className="text-sm text-muted-foreground">
                  {whenLabel(event, today)}
                  {event.location_name && ` · ${event.location_name}`}
                </p>
                <EventBadges event={event} now={now} />
              </div>
              <ChevronRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

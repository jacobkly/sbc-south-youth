import { formatDateTime } from "@/lib/dates";
import { describeChanges, eventFilename, eventTitle, type RequestEvent } from "@/lib/requests/status";

export type TimelineEvent = RequestEvent & {
  id: string;
  actor: { full_name: string } | null;
};

/**
 * Everything that happened to a request, oldest first: status changes with
 * their notes, edits with before and after values, and receipt changes.
 */
export function StatusTimeline({
  events,
  payeeNames,
}: {
  /** Oldest first. */
  events: TimelineEvent[];
  /** Names for payee ids that edits mention. */
  payeeNames: ReadonlyMap<string, string>;
}) {
  if (events.length === 0) return <p className="text-muted-foreground">No history yet.</p>;

  return (
    <ol>
      {events.map((event) => {
        const filename = eventFilename(event);
        const changes = describeChanges(event, payeeNames);
        return (
          <li key={event.id} className="group relative flex gap-3 pb-6 last:pb-0">
            {/* The line joining each dot to the next one. */}
            <span aria-hidden className="absolute top-4 bottom-0 left-[5px] w-px bg-border group-last:hidden" />
            <span aria-hidden className="mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-muted-foreground bg-background" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-medium">{eventTitle(event)}</p>
              <p className="text-sm text-muted-foreground">
                <time dateTime={event.created_at}>{formatDateTime(event.created_at)}</time>
                {event.actor && <> · {event.actor.full_name}</>}
              </p>
              {filename && <p className="text-sm break-words">{filename}</p>}
              {changes.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {changes.map((change) => (
                    <li key={change.field} className="break-words whitespace-pre-wrap">
                      <span className="text-muted-foreground">{change.label}:</span> {change.from}{" "}
                      <span aria-hidden>→</span>
                      <span className="sr-only">changed to</span> {change.to}
                    </li>
                  ))}
                </ul>
              )}
              {event.note && (
                <blockquote className="border-l-2 pl-3 text-sm break-words whitespace-pre-wrap">{event.note}</blockquote>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

import { describeChanges, eventFilename, type RequestEvent } from "@/lib/requests/status";

/** What an event says beyond its title: the file, each field's before and after, and the note. */
export function EventDetails({
  event,
  payeeNames,
}: {
  event: Pick<RequestEvent, "action" | "note" | "changes">;
  /** Names for payee ids that edits mention. */
  payeeNames: ReadonlyMap<string, string>;
}) {
  const filename = eventFilename(event);
  const changes = describeChanges(event, payeeNames);
  return (
    <>
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
    </>
  );
}

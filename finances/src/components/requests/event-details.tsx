import { describeChanges, eventFilename, type RequestEvent } from "@/lib/requests/status";

/** Each field's before and after. */
export function ChangeList({ changes }: { changes: readonly { field: string; label: string; from: string; to: string }[] }) {
  if (changes.length === 0) return null;
  return (
    <ul className="space-y-1 text-sm">
      {changes.map((change) => (
        <li key={change.field} className="break-words whitespace-pre-wrap">
          <span className="text-muted-foreground">{change.label}:</span> {change.from}{" "}
          <span aria-hidden>→</span>
          <span className="sr-only">changed to</span> {change.to}
        </li>
      ))}
    </ul>
  );
}

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
  return (
    <>
      {filename && <p className="text-sm break-words">{filename}</p>}
      <ChangeList changes={describeChanges(event, payeeNames)} />
      {event.note && (
        <blockquote className="border-l-2 pl-3 text-sm break-words whitespace-pre-wrap">{event.note}</blockquote>
      )}
    </>
  );
}

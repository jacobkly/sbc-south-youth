import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { messagePreview, type MessageRow } from "@/lib/portal/messages/list";
import { when } from "@/lib/portal/posts/list";
import { MessageBadges } from "./message-badges";

const ROW =
  "flex min-w-0 items-start gap-3 p-4 outline-none hover:bg-muted/50 " +
  "focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset";

/** Who has a message or closed it, as the list says it. */
export type People = { names: ReadonlyMap<string, string>; meId: string };

function personName(id: string, { names, meId }: People, you = "You"): string {
  return id === meId ? you : (names.get(id) ?? "Someone");
}

/** When it came in and who has it, or when it was closed and by whom. */
function metaLine(message: MessageRow, now: Date, people: People): string {
  if (message.handled_at) {
    const verb = message.status === "spam" ? "Marked as spam" : "Handled";
    const by = message.handled_by ? ` by ${personName(message.handled_by, people, "you")}` : "";
    return `${verb} ${when(message.handled_at, now)}${by}`;
  }
  const came = `Came in ${when(message.created_at, now)}`;
  if (!message.assigned_to) return came;
  const who = personName(message.assigned_to, people);
  return `${came} · ${who === "You" ? "You have it" : `${who} has it`}`;
}

/** Messages, each opening its own page. */
export function MessageRows({ messages, now, people }: { messages: MessageRow[]; now: Date; people: People }) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {messages.map((message) => (
        <li key={message.id}>
          <Link href={`/messages/${message.id}`} className={ROW}>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="truncate font-medium">{message.name}</p>
              <p className="line-clamp-2 text-sm break-words text-muted-foreground">{messagePreview(message)}</p>
              <p className="text-sm text-muted-foreground">{metaLine(message, now, people)}</p>
              <MessageBadges message={message} />
            </div>
            <ChevronRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** A group of messages under its own heading. Nothing at all when the group is empty. */
export function MessageSection({
  id,
  title,
  description,
  count,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-3">
      <div className="space-y-1">
        <h2 id={`${id}-heading`} className="flex items-baseline gap-2 text-lg font-semibold">
          {title}
          <span className="text-sm font-normal text-muted-foreground">{count}</span>
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

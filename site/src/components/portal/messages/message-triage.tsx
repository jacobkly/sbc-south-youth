"use client";

import { useId, useOptimistic, useRef, useState, useTransition } from "react";
import {
  ArchiveRestoreIcon,
  BanIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  HandIcon,
  TriangleAlertIcon,
  UndoIcon,
  UserRoundXIcon,
} from "lucide-react";
import { UserAvatar } from "@/components/portal/nav/user-avatar";
import { Alert, AlertDescription } from "@/components/portal/ui/alert";
import { Badge } from "@/components/portal/ui/badge";
import { Button } from "@/components/portal/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/portal/ui/dropdown-menu";
import { Label } from "@/components/portal/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/portal/ui/radio-group";
import { Textarea } from "@/components/portal/ui/textarea";
import { triageMessage, type TriageResult } from "@/lib/portal/messages/actions";
import { isClosed, OUTCOME_LABELS, STATUS_LABELS, type MessageRow, type ServeOutcome } from "@/lib/portal/messages/list";
import { applyTriage, NOTE_LIMIT, type TriageChanges } from "@/lib/portal/messages/triage";
import type { Assignee } from "@/lib/portal/messages/queries";
import { when } from "@/lib/portal/posts/list";

type Part = "status" | "assign" | "outcome" | "note";
type Feedback = { part: Part; kind: "saved" | "error"; text: string };

const FALLBACK = "Couldn't save that. Check your connection and try again.";
const NOBODY = "nobody";
const NOT_YET = "not_yet";
/** Past this, the note says how close it is to the limit. */
const NOTE_WARNING = NOTE_LIMIT - 200;

const OUTCOME_CHOICES: { value: ServeOutcome | typeof NOT_YET; label: string }[] = [
  { value: NOT_YET, label: "Not decided yet" },
  { value: "placed", label: OUTCOME_LABELS.placed },
  { value: "not_now", label: OUTCOME_LABELS.not_now },
];

const OPTION_ROW = "min-h-11 cursor-pointer items-center gap-3 px-4 py-3 font-normal leading-snug";

async function run(action: () => Promise<TriageResult>): Promise<TriageResult> {
  try {
    return await action();
  } catch {
    return { status: "failed", message: FALLBACK };
  }
}

function FeedbackLine({ feedback, part }: { feedback: Feedback | null; part: Part }) {
  if (feedback?.part !== part) return null;
  if (feedback.kind === "error") {
    return (
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertDescription>{feedback.text}</AlertDescription>
      </Alert>
    );
  }
  return (
    <p role="status" className="flex items-start gap-2 text-sm text-muted-foreground">
      <CircleCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      {feedback.text}
    </p>
  );
}

/**
 * Following up on a message: its status, who has it, how a serve request
 * went, and a note for other leaders. Each change shows at once and saves
 * on its own. On staging it's all read-only.
 */
export function MessageTriage({
  message,
  meId,
  assignees,
  names,
  nowIso,
  readOnly,
}: {
  message: MessageRow;
  meId: string;
  assignees: Assignee[];
  /** Everyone's name by user ID, for whoever has it or closed it. */
  names: Record<string, string>;
  nowIso: string;
  readOnly: boolean;
}) {
  const [shown, apply] = useOptimistic(message, (current: MessageRow, changes: TriageChanges) =>
    applyTriage(current, changes, meId, new Date()),
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [note, setNote] = useState(message.internal_note ?? "");
  const [pending, startTransition] = useTransition();
  const statusHeading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const busy = readOnly || pending;
  const closed = isClosed(shown.status);
  const now = new Date(nowIso);

  const nameOf = (person: string, you = "You") => (person === meId ? you : (names[person] ?? "Someone"));
  const me = assignees.find((person) => person.id === meId);
  const others = assignees.filter((person) => person.id !== meId);
  const holder = shown.assigned_to ? assignees.find((person) => person.id === shown.assigned_to) : undefined;
  const savedNote = message.internal_note ?? "";
  const noteLength = [...note.trim()].length;

  function save(part: Part, changes: TriageChanges) {
    setFeedback(null);
    startTransition(async () => {
      apply(changes);
      const result = await run(() => triageMessage(message.id, changes));
      setFeedback({ part, kind: result.status === "done" ? "saved" : "error", text: result.message });
      // A status change swaps the buttons, so the heading is where to pick up from.
      if (part === "status") requestAnimationFrame(() => statusHeading.current?.focus());
    });
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-6">
      <h2 id={`${id}-heading`} className="text-lg font-semibold">
        Follow up
      </h2>

      {readOnly && (
        <Alert>
          <TriangleAlertIcon />
          <AlertDescription>
            This is the staging copy of the portal, so it can&apos;t change messages. Use the real portal to follow
            up.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4 rounded-xl border bg-card p-4" aria-busy={pending || undefined}>
        <div className="space-y-1">
          <h3
            ref={statusHeading}
            tabIndex={-1}
            className="flex flex-wrap items-center gap-2 font-medium outline-none"
          >
            Status
            <Badge variant={shown.status === "new" ? "default" : "outline"}>{STATUS_LABELS[shown.status]}</Badge>
          </h3>
          {shown.handled_at && (
            <p className="text-sm text-muted-foreground">
              {shown.status === "spam" ? "Marked as spam" : "Handled"} {when(shown.handled_at, now)}
              {shown.handled_by && ` by ${nameOf(shown.handled_by, "you")}`}.
              {shown.status === "spam" && " It goes after 30 days unless someone reopens it."}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {shown.status === "new" && (
            <>
              <Button
                type="button"
                className="h-11 sm:px-5"
                disabled={busy}
                onClick={() =>
                  save("status", { status: "in_progress", ...(shown.assigned_to ? {} : { assigned_to: meId }) })
                }
              >
                <HandIcon aria-hidden />
                Pick it up
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:px-5"
                disabled={busy}
                onClick={() => save("status", { status: "handled" })}
              >
                <CheckIcon aria-hidden />
                Mark handled
              </Button>
            </>
          )}
          {shown.status === "in_progress" && (
            <>
              <Button
                type="button"
                className="h-11 sm:px-5"
                disabled={busy}
                onClick={() => save("status", { status: "handled" })}
              >
                <CheckIcon aria-hidden />
                Mark handled
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:px-5"
                disabled={busy}
                onClick={() => save("status", { status: "new" })}
              >
                <UndoIcon aria-hidden />
                Move back to New
              </Button>
            </>
          )}
          {closed && (
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:px-5"
              disabled={busy}
              onClick={() => save("status", { status: shown.status === "spam" ? "new" : "in_progress" })}
            >
              <ArchiveRestoreIcon aria-hidden />
              {shown.status === "spam" ? "Not spam" : "Reopen"}
            </Button>
          )}
          {!closed && (
            <Button
              type="button"
              variant="ghost"
              className="h-11 text-muted-foreground sm:ml-auto"
              disabled={busy}
              onClick={() => save("status", { status: "spam" })}
            >
              <BanIcon aria-hidden />
              Mark as spam
            </Button>
          )}
        </div>
        <FeedbackLine feedback={feedback} part="status" />
      </div>

      <div className="space-y-2">
        <h3 id={`${id}-assign`} className="font-medium">
          Who has it
        </h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full justify-start gap-3 bg-card px-3 sm:w-80"
              disabled={busy}
              aria-labelledby={`${id}-assign ${id}-holder`}
            >
              {shown.assigned_to ? (
                <UserAvatar
                  name={holder?.name ?? nameOf(shown.assigned_to)}
                  path={holder?.avatarPath ?? null}
                  className="size-7"
                />
              ) : (
                <span className="flex size-7 items-center justify-center rounded-full bg-muted" aria-hidden>
                  <UserRoundXIcon className="size-4 text-muted-foreground" />
                </span>
              )}
              <span id={`${id}-holder`} className="min-w-0 flex-1 truncate text-left">
                {shown.assigned_to ? nameOf(shown.assigned_to) : "Nobody yet"}
              </span>
              <ChevronDownIcon aria-hidden className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-64">
            <DropdownMenuLabel>Leaders with Messages</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={shown.assigned_to ?? NOBODY}
              onValueChange={(value) => save("assign", { assigned_to: value === NOBODY ? null : value })}
            >
              {[...(me ? [me] : []), ...others].map((person) => (
                <DropdownMenuRadioItem key={person.id} value={person.id} className="min-h-11 gap-3">
                  <UserAvatar name={person.name} path={person.avatarPath} className="size-7" />
                  <span className="truncate">{person.id === meId ? `${person.name} (you)` : person.name}</span>
                </DropdownMenuRadioItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuRadioItem value={NOBODY} className="min-h-11">
                Nobody
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <p className="text-sm text-muted-foreground">So other leaders know someone&apos;s on it.</p>
        <FeedbackLine feedback={feedback} part="assign" />
      </div>

      {message.kind === "serve" && (
        <div className="space-y-2">
          <h3 id={`${id}-outcome`} className="font-medium">
            How it went
          </h3>
          <RadioGroup
            value={shown.outcome ?? NOT_YET}
            onValueChange={(value) =>
              save("outcome", { outcome: value === NOT_YET ? null : (value as ServeOutcome) })
            }
            aria-labelledby={`${id}-outcome`}
            disabled={busy}
            className="gap-0 divide-y overflow-hidden rounded-xl border bg-card"
          >
            {OUTCOME_CHOICES.map((choice) => (
              <Label key={choice.value} htmlFor={`${id}-${choice.value}`} className={OPTION_ROW}>
                <RadioGroupItem id={`${id}-${choice.value}`} value={choice.value} />
                <span className="text-base desktop:text-sm">{choice.label}</span>
              </Label>
            ))}
          </RadioGroup>
          <FeedbackLine feedback={feedback} part="outcome" />
        </div>
      )}

      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          save("note", { internal_note: note });
        }}
      >
        <Label htmlFor={`${id}-note`} className="text-base font-medium desktop:text-sm">
          Note for leaders
        </Label>
        <Textarea
          id={`${id}-note`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          disabled={readOnly}
          aria-describedby={`${id}-note-hint`}
          placeholder="Like “Called Sunday. Coming to visit next week.”"
        />
        <p id={`${id}-note-hint`} className="text-xs text-muted-foreground">
          Only leaders with Messages see this. The sender never does.
          {noteLength > NOTE_WARNING && ` ${noteLength.toLocaleString("en-US")} of 2,000 characters.`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            variant="outline"
            className="h-11 px-5"
            disabled={busy || note.trim() === savedNote.trim()}
          >
            {savedNote && !note.trim() ? "Clear note" : "Save note"}
          </Button>
        </div>
        <FeedbackLine feedback={feedback} part="note" />
      </form>
    </section>
  );
}

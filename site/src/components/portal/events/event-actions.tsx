"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { CalendarCheckIcon, CalendarXIcon, CircleCheckIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { describedBy, FormField } from "@/components/portal/form-field";
import { Alert, AlertDescription } from "@/components/portal/ui/alert";
import { Button } from "@/components/portal/ui/button";
import { ResponsiveSheetContent } from "@/components/portal/ui/responsive-sheet";
import { Sheet, SheetClose, SheetDescription, SheetHeader, SheetTitle } from "@/components/portal/ui/sheet";
import { Textarea } from "@/components/portal/ui/textarea";
import { cancelEvent, deleteEvent, restoreEvent, type EventActionResult } from "@/lib/portal/events/actions";
import { REASON_MAX } from "@/lib/portal/events/save";

type Message = { kind: "saved" | "error"; text: string };

/** What asking first looks like for each action that does. */
const CONFIRMS = {
  cancel: {
    title: "Cancel this event?",
    description:
      "It comes off This Week and Home. Its page stays up with a Cancelled banner, so a shared link still " +
      "explains, and subscribed calendars mark it cancelled the next time they check.",
    confirm: "Cancel event",
    working: "Cancelling…",
    keep: "Keep it on",
  },
  delete: {
    title: "Delete this draft?",
    description: "It's gone for good. Nobody saw it, since it was never published.",
    confirm: "Delete draft",
    working: "Deleting…",
    keep: "Keep it",
  },
};

async function run(action: () => Promise<EventActionResult>, fallback: string): Promise<EventActionResult> {
  try {
    return await action();
  } catch {
    return { status: "failed", message: fallback };
  }
}

/**
 * What can be done with an event besides editing it: delete a draft,
 * cancel one that went out, or put a cancelled one back on. Deleting and
 * cancelling ask first, and a cancel can say why.
 */
export function EventActions({
  id,
  state,
  readOnly,
}: {
  id: string;
  state: "draft" | "upcoming" | "happening" | "cancelled";
  readOnly: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<Message | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const opener = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // Once the sheet's action is done, the button that opened it is gone, so focus goes to the heading.
  const confirmed = useRef(false);
  const busy = readOnly || pending;
  // Each state has at most one action that asks first.
  const kind = state === "draft" ? "delete" : "cancel";
  const sheet = CONFIRMS[kind];

  function restore() {
    setMessage(null);
    startTransition(async () => {
      const result = await run(
        () => restoreEvent(id),
        "Couldn't put the event back on. Check your connection and try again.",
      );
      setMessage({ kind: result.status === "done" ? "saved" : "error", text: result.message });
      // The page changes once it's done, so the heading is where to pick up from.
      requestAnimationFrame(() => heading.current?.focus());
    });
  }

  function confirm() {
    setSheetError(null);
    startTransition(async () => {
      const result =
        kind === "cancel"
          ? await run(
              () => cancelEvent(id, reason),
              "Couldn't cancel the event. Check your connection and try again.",
            )
          : await run(() => deleteEvent(id), "Couldn't delete the draft. Check your connection and try again.");
      // A failure stays in the sheet, where trying again is one tap away.
      if (result.status === "failed") {
        setSheetError(result.message);
        return;
      }
      // A deleted draft has no page left. A cancelled event refreshes into its cancelled view.
      if (kind === "delete") {
        setConfirming(false);
        router.replace("/events");
        return;
      }
      confirmed.current = true;
      setConfirming(false);
      setReason("");
      setMessage({ kind: "saved", text: result.message });
    });
  }

  return (
    <section aria-labelledby="event-actions-heading" className="space-y-4">
      <h2 id="event-actions-heading" ref={heading} tabIndex={-1} className="text-lg font-semibold outline-none">
        {state === "draft" ? "Don't need it?" : state === "cancelled" ? "Back on after all?" : "Called off?"}
      </h2>

      <div className="space-y-3 rounded-xl border bg-card p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <p className="min-w-0 text-sm text-muted-foreground">
          {state === "draft"
            ? "A draft was never on the site, so deleting it leaves nothing behind."
            : state === "cancelled"
              ? "Putting it back on brings it back to This Week and takes the banner off. Calendars catch up too."
              : "Cancelling keeps its page up with a banner and tells calendars. You can put it back on later."}
        </p>
        {state === "cancelled" ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full shrink-0 sm:w-auto"
            disabled={busy}
            onClick={restore}
          >
            <CalendarCheckIcon aria-hidden />
            {pending ? "Putting it back…" : "Put it back on"}
          </Button>
        ) : (
          <Button
            ref={opener}
            type="button"
            variant="outline"
            className="h-11 w-full shrink-0 text-destructive hover:text-destructive sm:w-auto"
            disabled={busy}
            onClick={() => {
              setMessage(null);
              setSheetError(null);
              setConfirming(true);
            }}
          >
            {state === "draft" ? <Trash2Icon aria-hidden /> : <CalendarXIcon aria-hidden />}
            {state === "draft" ? "Delete draft" : "Cancel event"}
          </Button>
        )}
      </div>

      {message?.kind === "error" && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
      {message?.kind === "saved" && (
        <p role="status" className="flex items-start gap-2 text-sm text-muted-foreground">
          <CircleCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {message.text}
        </p>
      )}

      <Sheet
        open={confirming}
        onOpenChange={(open) => {
          if (!pending) setConfirming(open);
        }}
      >
        <ResponsiveSheetContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (confirmed.current ? heading.current : opener.current)?.focus();
            confirmed.current = false;
          }}
        >
          <SheetHeader className="pr-12">
            <SheetTitle>{sheet.title}</SheetTitle>
            <SheetDescription>{sheet.description}</SheetDescription>
          </SheetHeader>
          {kind === "cancel" && (
            <div className="px-4">
              <FormField
                id="event-cancel-reason"
                label="Why"
                optional
                hint={`On its page and in calendars. ${reason.length} of ${REASON_MAX} characters.`}
              >
                <Textarea
                  id="event-cancel-reason"
                  rows={2}
                  autoCapitalize="sentences"
                  maxLength={REASON_MAX}
                  className="min-h-16"
                  value={reason}
                  disabled={busy}
                  aria-describedby={describedBy("event-cancel-reason", undefined, true)}
                  onChange={(event) => setReason(event.target.value)}
                />
              </FormField>
            </div>
          )}
          {sheetError && (
            <Alert variant="destructive" className="mx-4 w-auto">
              <TriangleAlertIcon />
              <AlertDescription>{sheetError}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col-reverse gap-2 px-4 pt-2 desktop:flex-row desktop:justify-end">
            <SheetClose asChild>
              <Button type="button" variant="outline" className="h-11 desktop:min-w-28" disabled={pending}>
                {sheet.keep}
              </Button>
            </SheetClose>
            <Button
              type="button"
              variant="destructive"
              className="h-11 desktop:min-w-28"
              disabled={busy}
              onClick={confirm}
            >
              {pending ? sheet.working : sheetError ? "Try again" : sheet.confirm}
            </Button>
          </div>
        </ResponsiveSheetContent>
      </Sheet>
    </section>
  );
}

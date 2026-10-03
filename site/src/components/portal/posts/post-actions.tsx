"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ArchiveIcon, CalendarOffIcon, CircleCheckIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/portal/ui/alert";
import { Button } from "@/components/portal/ui/button";
import { ResponsiveSheetContent } from "@/components/portal/ui/responsive-sheet";
import { Sheet, SheetClose, SheetDescription, SheetHeader, SheetTitle } from "@/components/portal/ui/sheet";
import { deletePost, endPost, unschedulePost, type PostActionResult } from "@/lib/portal/posts/actions";

type Message = { kind: "saved" | "error"; text: string };

/** What asking first looks like for each action that does. */
const CONFIRMS = {
  end: {
    title: "End this heads-up now?",
    description: "It comes down from Home and This Week right away. You can post it again later.",
    confirm: "End now",
    working: "Ending…",
  },
  delete: {
    title: "Delete this draft?",
    description: "It's gone for good. Nobody saw it, since it was never published.",
    confirm: "Delete draft",
    working: "Deleting…",
  },
};

async function run(action: () => Promise<PostActionResult>, fallback: string): Promise<PostActionResult> {
  try {
    return await action();
  } catch {
    return { status: "failed", message: fallback };
  }
}

/**
 * What can be done with a heads-up besides editing it: end one that's up,
 * move a scheduled one back to drafts, or delete a draft. Ending and
 * deleting ask first.
 */
export function PostActions({
  id,
  state,
  readOnly,
}: {
  id: string;
  state: "live" | "scheduled" | "draft";
  readOnly: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<Message | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const opener = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const busy = readOnly || pending;
  // Each state has at most one action that asks first.
  const kind = state === "live" ? "end" : "delete";
  const sheet = CONFIRMS[kind];

  function unschedule() {
    setMessage(null);
    startTransition(async () => {
      const result = await run(
        () => unschedulePost(id),
        "Couldn't move it to drafts. Check your connection and try again.",
      );
      setMessage({ kind: result.status === "done" ? "saved" : "error", text: result.message });
      // The buttons change once it's done, so the heading is where to pick up from.
      requestAnimationFrame(() => heading.current?.focus());
    });
  }

  function confirm() {
    setSheetError(null);
    startTransition(async () => {
      const result =
        kind === "end"
          ? await run(() => endPost(id), "Couldn't end the heads-up. Check your connection and try again.")
          : await run(() => deletePost(id), "Couldn't delete the draft. Check your connection and try again.");
      // A failure stays in the sheet, where trying again is one tap away.
      if (result.status === "failed") {
        setSheetError(result.message);
        return;
      }
      setConfirming(false);
      // A deleted draft has no page left. An ended one refreshes into what's left of it.
      if (kind === "delete") router.replace("/posts");
    });
  }

  return (
    <section aria-labelledby="post-actions-heading" className="space-y-4">
      <h2 id="post-actions-heading" ref={heading} tabIndex={-1} className="text-lg font-semibold outline-none">
        {state === "live" ? "Take it down" : state === "scheduled" ? "Not ready yet?" : "Don't need it?"}
      </h2>

      <div className="space-y-3 rounded-xl border bg-card p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <p className="min-w-0 text-sm text-muted-foreground">
          {state === "live"
            ? "Ending it takes it off Home and This Week right away. It stays in Came down, so you can post it again."
            : state === "scheduled"
              ? "Moving it to drafts keeps it from going up. Publish it again whenever it's ready."
              : "A draft was never on the site, so deleting it leaves nothing behind."}
        </p>
        {state === "scheduled" ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full shrink-0 sm:w-auto"
            disabled={busy}
            onClick={unschedule}
          >
            <ArchiveIcon aria-hidden />
            {pending ? "Moving…" : "Move to drafts"}
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
            {state === "live" ? <CalendarOffIcon aria-hidden /> : <Trash2Icon aria-hidden />}
            {state === "live" ? "End now" : "Delete draft"}
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
            opener.current?.focus();
          }}
        >
          <SheetHeader className="pr-12">
            <SheetTitle>{sheet.title}</SheetTitle>
            <SheetDescription>{sheet.description}</SheetDescription>
          </SheetHeader>
          {sheetError && (
            <Alert variant="destructive" className="mx-4 w-auto">
              <TriangleAlertIcon />
              <AlertDescription>{sheetError}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col-reverse gap-2 px-4 pt-2 desktop:flex-row desktop:justify-end">
            <SheetClose asChild>
              <Button type="button" variant="outline" className="h-11 desktop:min-w-28" disabled={pending}>
                Cancel
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

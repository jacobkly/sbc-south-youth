"use client";

import { useRef, useState, useTransition } from "react";
import { CircleCheckIcon, MailIcon, RotateCcwIcon, TriangleAlertIcon, UserXIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/portal/ui/alert";
import { Button } from "@/components/portal/ui/button";
import { ResponsiveSheetContent } from "@/components/portal/ui/responsive-sheet";
import { Sheet, SheetClose, SheetDescription, SheetHeader, SheetTitle } from "@/components/portal/ui/sheet";
import type { PersonControls } from "@/lib/portal/people/person";
import {
  reinstatePerson,
  removeAccess,
  resendInvite,
  type PersonResult,
} from "@/lib/portal/people/person-actions";

type Message = { kind: "saved"; text: string; warning: string | null } | { kind: "error"; text: string };

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

async function run(action: () => Promise<PersonResult>, fallback: string): Promise<PersonResult> {
  try {
    return await action();
  } catch {
    return { status: "failed", message: fallback };
  }
}

/**
 * Sending a pending invite again, and removing or giving back someone's
 * access. Removing asks first; their roles are kept for reinstating.
 */
export function PersonAccess({
  userId,
  name,
  controls,
  readOnly,
}: {
  userId: string;
  name: string;
  controls: PersonControls;
  readOnly: boolean;
}) {
  const [message, setMessage] = useState<Message | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Which button is working, so only it says so.
  const [doing, setDoing] = useState<"resend" | "reinstate" | "remove" | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const removeButton = useRef<HTMLButtonElement>(null);
  const removed = useRef(false);
  const first = firstName(name);

  function finish(result: PersonResult) {
    setMessage(
      result.status === "done"
        ? { kind: "saved", text: result.message, warning: result.warning }
        : { kind: "error", text: result.message },
    );
    // The buttons change once it's done, so the heading is where to pick up from.
    requestAnimationFrame(() => heading.current?.focus());
  }

  function resend() {
    setMessage(null);
    setDoing("resend");
    startTransition(async () => {
      finish(await run(() => resendInvite(userId), "Couldn't send the invite. Check your connection and try again."));
    });
  }

  function reinstate() {
    setMessage(null);
    setDoing("reinstate");
    startTransition(async () => {
      finish(await run(() => reinstatePerson(userId), "Couldn't reinstate them. Check your connection and try again."));
    });
  }

  function remove() {
    setRemoveError(null);
    setDoing("remove");
    startTransition(async () => {
      const result = await run(
        () => removeAccess(userId),
        "Couldn't remove their access. Check your connection and try again.",
      );
      // A failure stays in the sheet, where trying again is one tap away.
      if (result.status === "failed") {
        setRemoveError(result.message);
        return;
      }
      removed.current = true;
      setConfirming(false);
      setMessage({ kind: "saved", text: result.message, warning: result.warning });
    });
  }

  const busy = readOnly || pending;

  return (
    <section aria-labelledby="access-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="access-heading" ref={heading} tabIndex={-1} className="text-lg font-semibold outline-none">
          Access
        </h2>
        <p className="text-sm text-muted-foreground">
          {controls.reinstate
            ? `${first} can't sign in to the portal or finances. Reinstating gives back the roles above.`
            : controls.you
              ? "This is you. Another owner can remove your access if they ever need to."
              : controls.resend
                ? `${first} can sign in once they set up their account from the invite email.`
                : `${first} signs in to the portal and finances with their email and password.`}
        </p>
      </div>

      {(controls.resend || controls.remove || controls.reinstate) && (
        <div className="divide-y overflow-hidden rounded-xl border bg-card">
          {controls.resend && (
            <AccessRow
              title="Invite"
              description="Not set up yet. If the email got lost, send it again."
            >
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full sm:w-auto"
                disabled={busy}
                onClick={resend}
              >
                <MailIcon aria-hidden />
                {pending && doing === "resend" ? "Sending…" : "Resend invite"}
              </Button>
            </AccessRow>
          )}
          {controls.remove && (
            <AccessRow
              title="Remove access"
              description="Ends their access to both apps right away. Their roles are kept, so you can reinstate them."
            >
              <Button
                ref={removeButton}
                type="button"
                variant="outline"
                className="h-11 w-full text-destructive hover:text-destructive sm:w-auto"
                disabled={busy}
                onClick={() => {
                  setMessage(null);
                  setRemoveError(null);
                  setConfirming(true);
                }}
              >
                <UserXIcon aria-hidden />
                Remove access
              </Button>
            </AccessRow>
          )}
          {controls.reinstate && (
            <AccessRow title="Reinstate" description="They sign in with the same email and password as before.">
              <Button type="button" className="h-11 w-full sm:w-auto" disabled={busy} onClick={reinstate}>
                <RotateCcwIcon aria-hidden />
                {pending && doing === "reinstate" ? "Reinstating…" : `Reinstate ${first}`}
              </Button>
            </AccessRow>
          )}
        </div>
      )}

      {message?.kind === "error" && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
      {message?.kind === "saved" && (
        <div className="space-y-3">
          <p role="status" className="flex items-start gap-2 text-sm text-muted-foreground">
            <CircleCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {message.text}
          </p>
          {message.warning && (
            <Alert>
              <TriangleAlertIcon />
              <AlertTitle>The email didn&apos;t go out</AlertTitle>
              <AlertDescription>{message.warning}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <Sheet
        open={confirming}
        onOpenChange={(open) => {
          if (!pending) setConfirming(open);
        }}
      >
        <ResponsiveSheetContent
          onCloseAutoFocus={(event) => {
            // Back to Remove on cancel; once it's gone, to the section that now offers Reinstate.
            event.preventDefault();
            (removed.current ? heading : removeButton).current?.focus();
            removed.current = false;
          }}
        >
          <SheetHeader className="pr-12">
            <SheetTitle>Remove {first}&apos;s access?</SheetTitle>
            <SheetDescription asChild>
              <div className="space-y-2">
                <p>They&apos;ll be signed out of the portal and finances, and can&apos;t sign back in.</p>
                <p>Their roles and history are kept, so you can reinstate them later.</p>
              </div>
            </SheetDescription>
          </SheetHeader>
          {removeError && (
            <Alert variant="destructive" className="mx-4 w-auto">
              <TriangleAlertIcon />
              <AlertDescription>{removeError}</AlertDescription>
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
              onClick={remove}
            >
              {pending ? "Removing…" : removeError ? "Try again" : "Remove access"}
            </Button>
          </div>
        </ResponsiveSheetContent>
      </Sheet>
    </section>
  );
}

function AccessRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:space-y-0">
      <div className="min-w-0 space-y-0.5">
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

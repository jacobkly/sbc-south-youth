"use client";

import { useRef, useState, useTransition } from "react";
import { CircleCheckIcon, MailCheckIcon, TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/portal/ui/alert";
import { Button } from "@/components/portal/ui/button";
import { ResponsiveSheetContent } from "@/components/portal/ui/responsive-sheet";
import { Sheet, SheetClose, SheetDescription, SheetHeader, SheetTitle } from "@/components/portal/ui/sheet";
import { allowAddress, type AllowResult } from "@/lib/portal/email/actions";
import type { Suppression } from "@/lib/portal/email/queries";

const REASONS: Record<Suppression["reason"], string> = {
  bounced: "Bounced",
  complained: "Marked as spam",
};

const FALLBACK = "Couldn't unblock it. Check your connection and try again.";

/**
 * Addresses nothing more is sent to, since they bounced or were marked as
 * spam. Unblocking asks first, since sending to a bad address again can
 * hurt the account's standing with Resend.
 */
export function BlockedAddresses({
  suppressions,
  dates,
  readOnly,
}: {
  suppressions: Suppression[];
  /** Each one's date, worked out on the server in Los Angeles time. */
  dates: Record<string, string>;
  readOnly: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  // Kept once the sheet closes, so it doesn't empty while it slides away.
  const [target, setTarget] = useState<Suppression | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const status = useRef<HTMLParagraphElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const unblocked = useRef(false);

  function unblock(suppression: Suppression) {
    setError(null);
    startTransition(async () => {
      let result: AllowResult;
      try {
        result = await allowAddress(suppression.id);
      } catch {
        result = { status: "failed", message: FALLBACK };
      }
      // A failure stays in the sheet, where trying again is one tap away.
      if (result.status === "failed") {
        setError(result.message);
        return;
      }
      unblocked.current = true;
      setConfirming(false);
      setDone(`Emails to ${suppression.address} can send again.`);
    });
  }

  return (
    <div className="space-y-3">
      {done && (
        <p
          role="status"
          ref={status}
          tabIndex={-1}
          className="flex items-start gap-2 text-sm text-muted-foreground outline-none"
        >
          <CircleCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="min-w-0 break-words">{done}</span>
        </p>
      )}

      {suppressions.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm">
          <MailCheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-muted-foreground">No blocked addresses.</p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {suppressions.map((suppression) => (
            <li
              key={suppression.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium break-all">{suppression.address}</p>
                <p className="text-sm text-muted-foreground">
                  {REASONS[suppression.reason]} · <time dateTime={suppression.createdAt}>{dates[suppression.id]}</time>
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full shrink-0 sm:w-auto"
                disabled={readOnly || pending}
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  setDone(null);
                  setError(null);
                  setTarget(suppression);
                  setConfirming(true);
                }}
              >
                Unblock
                <span className="sr-only"> {suppression.address}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={confirming}
        onOpenChange={(open) => {
          if (!pending) setConfirming(open);
        }}
      >
        <ResponsiveSheetContent
          onCloseAutoFocus={(event) => {
            // Back to its button on cancel; once it's gone from the list, to the message saying so.
            event.preventDefault();
            (unblocked.current ? status.current : opener.current)?.focus();
            unblocked.current = false;
          }}
        >
          {target && (
            <>
              <SheetHeader className="pr-12">
                <SheetTitle className="break-all">Unblock {target.address}?</SheetTitle>
                <SheetDescription asChild>
                  <div className="space-y-2">
                    <p>Emails to it start sending again.</p>
                    <p>
                      {target.reason === "complained"
                        ? "They marked an email as spam, so check they want these emails first."
                        : "Check the address works first. If it bounces again, it's blocked again."}
                    </p>
                  </div>
                </SheetDescription>
              </SheetHeader>
              {error && (
                <Alert variant="destructive" className="mx-4 w-auto">
                  <TriangleAlertIcon />
                  <AlertDescription>{error}</AlertDescription>
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
                  className="h-11 desktop:min-w-28"
                  disabled={readOnly || pending}
                  onClick={() => unblock(target)}
                >
                  {pending ? "Unblocking…" : error ? "Try again" : "Unblock"}
                </Button>
              </div>
            </>
          )}
        </ResponsiveSheetContent>
      </Sheet>
    </div>
  );
}

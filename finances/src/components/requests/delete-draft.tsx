"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlertIcon, Trash2Icon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ResponsiveSheetContent } from "@/components/ui/responsive-sheet";
import { Sheet, SheetClose, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCents } from "@/lib/money";
import { RETRY_MESSAGE } from "@/lib/requests/actions";
import { deleteDraft } from "@/lib/requests/drafts";
import { formatRequestNumber } from "@/lib/requests/format";
import { createClient } from "@/lib/supabase/client";

/**
 * Deletes a draft the signed-in person entered, with its receipts, after
 * confirming in a sheet. Goes to their home page once it's gone.
 */
export function DeleteDraft({
  request,
  userId,
  afterDeleteHref,
  disabled,
}: {
  /** `payeeName` reads after "to", so "you" works for a requester's own. */
  request: { id: string; requestNumber: number; amountCents: number; payeeName: string };
  userId: string;
  /** Where to go once it's deleted, like the dashboard. */
  afterDeleteHref: string;
  /** True while the form is saving. */
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setError(null);
    setPending(true);
    let message: string | null;
    try {
      message = await deleteDraft(createClient(), request.id, userId);
    } catch {
      message = RETRY_MESSAGE;
    }
    if (message) {
      setPending(false);
      setError(message);
      return;
    }
    // Stays pending while the next page loads. Replaced, so going back can't land on a deleted draft.
    router.replace(afterDeleteHref);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Trash2Icon aria-hidden />
        Delete draft
      </Button>

      <ResponsiveSheetContent>
        <SheetHeader className="pr-12">
          <SheetTitle>Delete this draft?</SheetTitle>
          <SheetDescription>
            {formatRequestNumber(request.requestNumber)} · {formatCents(request.amountCents)} to {request.payeeName}.
            This also deletes its receipts and can&apos;t be undone.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4">
          {error && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Couldn&apos;t delete it</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* "Go back" comes first so a PC focuses it when the dialog opens, but it shows below on phones. */}
          <div className="flex flex-col-reverse gap-2 pt-2 desktop:flex-row desktop:justify-end">
            <SheetClose asChild>
              <Button type="button" variant="outline" className="h-11 desktop:min-w-28" disabled={pending}>
                Go back
              </Button>
            </SheetClose>
            <Button
              type="button"
              variant="destructive"
              className="h-11 desktop:min-w-28"
              disabled={pending}
              onClick={() => void remove()}
            >
              {pending ? "Deleting…" : "Delete draft"}
            </Button>
          </div>
        </div>
      </ResponsiveSheetContent>
    </Sheet>
  );
}

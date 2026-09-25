"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlertIcon, Trash2Icon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCents } from "@/lib/money";
import { RETRY_MESSAGE } from "@/lib/requests/actions";
import { deleteDraft } from "@/lib/requests/drafts";
import { formatRequestNumber } from "@/lib/requests/format";
import { createClient } from "@/lib/supabase/client";

/**
 * Deletes a draft the signed-in admin entered, with its receipts, after
 * confirming in a sheet. Goes to the dashboard once it's gone.
 */
export function DeleteDraft({
  request,
  userId,
  disabled,
}: {
  request: { id: string; requestNumber: number; amountCents: number; payeeName: string };
  userId: string;
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
    // Stays pending while the dashboard loads. Replaced, so going back can't land on a deleted draft.
    router.replace("/admin");
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

      <SheetContent
        side="bottom"
        className="max-h-[92dvh] overflow-y-auto rounded-t-xl pb-[calc(1rem+env(safe-area-inset-bottom))] md:inset-x-0 md:bottom-6 md:mx-auto md:max-w-lg md:rounded-xl md:border"
      >
        <SheetHeader className="pr-12">
          <SheetTitle>Delete this draft?</SheetTitle>
          <SheetDescription>
            {formatRequestNumber(request.requestNumber)} · {formatCents(request.amountCents)} to {request.payeeName}.
            Its receipts are deleted too. This can&apos;t be undone.
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

          {/* "Go back" comes first so it gets focus when the sheet opens, but shows below on phones. */}
          <div className="flex flex-col-reverse gap-2 pt-2 md:flex-row md:justify-end">
            <SheetClose asChild>
              <Button type="button" variant="outline" className="h-11 md:min-w-28" disabled={pending}>
                Go back
              </Button>
            </SheetClose>
            <Button
              type="button"
              variant="destructive"
              className="h-11 md:min-w-28"
              disabled={pending}
              onClick={() => void remove()}
            >
              {pending ? "Deleting…" : "Delete draft"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

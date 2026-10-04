"use client";

import { useState } from "react";
import { InfoIcon } from "lucide-react";
import { describedBy, FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ResponsiveSheetContent } from "@/components/ui/responsive-sheet";
import { Sheet, SheetClose, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { MAX_NOTE } from "@/lib/requests/actions";
import { correctionReasonError, type CorrectionChanges } from "@/lib/requests/corrections";
import { formatRequestNumber } from "@/lib/requests/format";
import { describeChanges } from "@/lib/requests/status";

const REASON_ID = "correction-reason";

/** A correction waiting to be confirmed. */
export type PendingCorrection = {
  changes: CorrectionChanges | null;
  /** Like "1 file added, 1 removed". */
  files: string | null;
};

/**
 * Confirms a correction to an approved or paid request: what changes, and
 * what was wrong, which is kept in its history. A bottom sheet on phones and
 * a centered panel on wider screens.
 */
export function CorrectionSheet({
  opened,
  requestNumber,
  paid,
  reason,
  onReasonChange,
  onConfirm,
  onClose,
}: {
  opened: PendingCorrection | null;
  requestNumber: number;
  paid: boolean;
  /** Kept by the form, so it's still there if saving fails and it opens again. */
  reason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  // Keep showing the last correction while the sheet animates closed.
  const [last, setLast] = useState(opened);
  if (opened !== null && opened !== last) setLast(opened);
  const current = opened ?? last;
  const [error, setError] = useState<string | null>(null);

  const changes = current?.changes ? describeChanges({ action: "corrected", changes: current.changes }) : [];
  const totalChanged = paid && changes.some((change) => change.field === "amount_cents");

  function confirm() {
    const problem = correctionReasonError(reason);
    setError(problem);
    if (problem) {
      document.getElementById(REASON_ID)?.focus();
      return;
    }
    onConfirm();
  }

  return (
    <Sheet
      open={opened !== null}
      onOpenChange={(open) => {
        if (open) return;
        setError(null);
        onClose();
      }}
    >
      <ResponsiveSheetContent>
        {current && (
          <>
            <SheetHeader className="pr-12">
              <SheetTitle>Save the correction?</SheetTitle>
              <SheetDescription>
                {formatRequestNumber(requestNumber)} stays {paid ? "paid" : "approved"}. The changes and why show in its
                history.
              </SheetDescription>
            </SheetHeader>
            <form
              noValidate
              className="space-y-4 px-4"
              onSubmit={(event) => {
                event.preventDefault();
                confirm();
              }}
            >
              <ul className="space-y-1 rounded-lg border p-3 text-sm" aria-label="Changes">
                {changes.map((change) => (
                  <li key={change.field} className="break-words whitespace-pre-wrap">
                    <span className="text-muted-foreground">{change.label}:</span> {change.from}{" "}
                    <span aria-hidden>→</span>
                    <span className="sr-only">changed to</span> {change.to}
                  </li>
                ))}
                {current.files && (
                  <li>
                    <span className="text-muted-foreground">Receipt files:</span> {current.files}
                  </li>
                )}
              </ul>

              {totalChanged && (
                <Alert role="note">
                  <InfoIcon />
                  <AlertDescription>
                    It&apos;s already paid, so this only fixes the record. If you still owe the difference, enter a new
                    request for it.
                  </AlertDescription>
                </Alert>
              )}

              <FormField
                id={REASON_ID}
                label="What was wrong?"
                hint="Kept in the request's history."
                error={error ?? undefined}
              >
                <Textarea
                  id={REASON_ID}
                  name="reason"
                  value={reason}
                  onChange={(event) => {
                    onReasonChange(event.target.value);
                    if (error) setError(null);
                  }}
                  rows={3}
                  maxLength={MAX_NOTE}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={describedBy(REASON_ID, error ?? undefined, true)}
                />
              </FormField>

              {/* "Keep editing" comes first so a PC focuses it when the dialog opens, but it shows below on phones. */}
              <div className="flex flex-col-reverse gap-2 pt-2 desktop:flex-row desktop:justify-end">
                <SheetClose asChild>
                  <Button type="button" variant="outline" className="h-11 desktop:min-w-28">
                    Keep editing
                  </Button>
                </SheetClose>
                <Button type="submit" className="h-11 desktop:min-w-28">
                  Save correction
                </Button>
              </div>
            </form>
          </>
        )}
      </ResponsiveSheetContent>
    </Sheet>
  );
}

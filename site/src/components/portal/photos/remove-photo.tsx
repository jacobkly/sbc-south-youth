"use client";

import { useState } from "react";
import { LoaderCircleIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { describedBy, FormField } from "@/components/portal/form-field";
import { Alert, AlertDescription } from "@/components/portal/ui/alert";
import { Button } from "@/components/portal/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/portal/ui/select";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/portal/ui/sheet";
import { Textarea } from "@/components/portal/ui/textarea";
import { formatDayLabel, laDateOf, type IsoDate } from "@/lib/dates";
import { deletePhotoFiles, removePhoto } from "@/lib/portal/photos/actions";
import type { LibraryPhoto, TakedownRequest } from "@/lib/portal/photos/queries";
import { checkReason, REASON_MAX, type RemovalResult } from "@/lib/portal/photos/schema";
import type { PhotoActionResult } from "@/lib/portal/photos/upload";

const REASON_ID = "photo-reason";
const REQUEST_ID = "photo-request";
const NO_REQUEST = "none";

const OFFLINE = "Couldn't reach the portal. Check your connection and try again.";

/**
 * The photo sheet's second step: why it's coming down, and the takedown
 * request it answers. `takedowns` is null for someone who can't see
 * Messages, who then takes it down without linking one.
 */
export function RemovePhoto({
  photo,
  thumbnail,
  takedowns,
  takedownId,
  today,
  readOnly,
  busy,
  setBusy,
  onBack,
  onDone,
}: {
  photo: LibraryPhoto;
  thumbnail: string;
  takedowns: TakedownRequest[] | null;
  takedownId: string | null;
  today: IsoDate;
  readOnly: boolean;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onBack: () => void;
  onDone: (result: RemovalResult) => void;
}) {
  const [reason, setReason] = useState(takedownId ? "Asked to take it down" : "");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [request, setRequest] = useState(
    takedowns?.some(({ id }) => id === takedownId) && takedownId ? takedownId : NO_REQUEST,
  );
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    const checked = checkReason(reason);
    if (!checked.ok) {
      setReasonError(checked.error);
      document.getElementById(REASON_ID)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    let result: RemovalResult;
    try {
      result = await removePhoto({
        id: photo.id,
        reason: checked.reason,
        messageId: request === NO_REQUEST ? null : request,
      });
    } catch {
      result = { status: "failed", message: OFFLINE };
    } finally {
      setBusy(false);
    }
    // Once it's down, the sheet closes even with its files left, since the library no longer has it.
    if (result.status === "failed") setError(result.message);
    else onDone(result);
  }

  return (
    <>
      <SheetHeader className="pr-12">
        <SheetTitle>Take this photo down?</SheetTitle>
        <SheetDescription>
          It comes off the site and its files are deleted. Who took it down and why are kept for 2 years.
        </SheetDescription>
      </SheetHeader>

      <form
        className="space-y-4 px-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void remove();
        }}
      >
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- already sized when it was uploaded */}
          <img src={thumbnail} alt="" className="size-16 shrink-0 rounded-md bg-muted object-cover" />
          <p className="line-clamp-3 min-w-0 text-sm text-muted-foreground">{photo.alt}</p>
        </div>

        <FormField
          id={REASON_ID}
          label="Why it's coming down"
          hint="Like “A parent asked” or “Out of focus”. Don't name anyone."
          error={reasonError}
        >
          <Textarea
            id={REASON_ID}
            rows={2}
            autoCapitalize="sentences"
            maxLength={REASON_MAX}
            className="min-h-16"
            value={reason}
            disabled={readOnly}
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={describedBy(REASON_ID, reasonError, true)}
            onChange={(event) => {
              setReason(event.target.value);
              if (reasonError) setReasonError(undefined);
            }}
          />
        </FormField>

        {takedowns && takedowns.length > 0 && (
          <FormField
            id={REQUEST_ID}
            label="Takedown request"
            optional
            hint="Linking it shows the request that the photo is down."
          >
            <Select value={request} onValueChange={setRequest} disabled={readOnly}>
              <SelectTrigger
                id={REQUEST_ID}
                aria-describedby={`${REQUEST_ID}-hint`}
                className="w-full text-base data-[size=default]:h-11 desktop:text-sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_REQUEST}>None</SelectItem>
                {takedowns.map((takedown) => (
                  <SelectItem key={takedown.id} value={takedown.id}>
                    {takedown.name}
                    <span className="text-muted-foreground">{formatDayLabel(laDateOf(takedown.createdAt), today)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}

        {error && (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col-reverse gap-2 pt-2 desktop:flex-row desktop:justify-end">
          <Button type="button" variant="outline" className="h-11 px-5" disabled={busy} onClick={onBack}>
            Back
          </Button>
          <Button type="submit" variant="destructive" className="h-11 px-5" disabled={readOnly || busy}>
            {busy ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <Trash2Icon aria-hidden />}
            {busy ? "Taking it down…" : "Take it down"}
          </Button>
        </div>
      </form>
    </>
  );
}

/** Deletes the files a photo left behind when it came down. */
export function DeleteFilesButton({ id, readOnly }: { id: string; readOnly: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    let result: PhotoActionResult;
    try {
      result = await deletePhotoFiles(id);
    } catch {
      result = { status: "failed", message: OFFLINE };
    } finally {
      setBusy(false);
    }
    if (result.status === "failed") setError(result.message);
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="h-11 px-4"
        disabled={readOnly || busy}
        onClick={() => void run()}
      >
        {busy ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <Trash2Icon aria-hidden />}
        {busy ? "Deleting…" : "Delete its files"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { LoaderCircleIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { describedBy, FormField } from "@/components/portal/form-field";
import { Alert, AlertDescription } from "@/components/portal/ui/alert";
import { Button } from "@/components/portal/ui/button";
import { ResponsiveSheetContent } from "@/components/portal/ui/responsive-sheet";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/portal/ui/select";
import { Separator } from "@/components/portal/ui/separator";
import { Sheet, SheetClose, SheetDescription, SheetHeader, SheetTitle } from "@/components/portal/ui/sheet";
import { Textarea } from "@/components/portal/ui/textarea";
import { formatDayLabel, formatWeekdayDate, laDateOf, type IsoDate } from "@/lib/dates";
import { photoUrl } from "@/lib/photo-files";
import { spotsByPage } from "@/lib/photo-spots";
import { savePhoto } from "@/lib/portal/photos/actions";
import { placementLabel, placementNote, type PlacedEvent } from "@/lib/portal/photos/placement";
import type { CoverEvent, LibraryPhoto, TakedownRequest } from "@/lib/portal/photos/queries";
import { ALT_MAX, checkAlt, LIBRARY, placementValue, type RemovalResult } from "@/lib/portal/photos/schema";
import type { PhotoActionResult } from "@/lib/portal/photos/upload";
import { RemovePhoto } from "./remove-photo";

export type PhotoSheetProps = {
  photos: LibraryPhoto[];
  events: CoverEvent[];
  /** Null for someone who can't see Messages. */
  takedowns: TakedownRequest[] | null;
  /** The takedown request they came from, to link. */
  takedownId: string | null;
  names: Record<string, string>;
  supabaseUrl: string;
  today: IsoDate;
  readOnly: boolean;
};

type Done = (result: PhotoActionResult | RemovalResult, kind: "saved" | "removed") => void;

/**
 * One photo, opened from the library: its description and where it shows,
 * and a second step to take it down. Closing waits for a save or takedown
 * that's halfway through.
 */
export function PhotoSheet({
  photo,
  open,
  onOpenChange,
  onDone,
  onCloseAutoFocus,
  ...props
}: PhotoSheetProps & {
  photo: LibraryPhoto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: Done;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const [busy, setBusy] = useState(false);

  function block(event: Event) {
    if (busy) event.preventDefault();
  }

  return (
    <Sheet open={open} onOpenChange={(next) => (next || !busy) && onOpenChange(next)}>
      <ResponsiveSheetContent onInteractOutside={block} onEscapeKeyDown={block} onCloseAutoFocus={onCloseAutoFocus}>
        {photo && (
          <PhotoDetails key={photo.id} photo={photo} busy={busy} setBusy={setBusy} onDone={onDone} {...props} />
        )}
      </ResponsiveSheetContent>
    </Sheet>
  );
}

const ALT_ID = "photo-edit-alt";
const PLACE_ID = "photo-edit-place";

function PhotoDetails({
  photo,
  photos,
  events,
  takedowns,
  takedownId,
  names,
  supabaseUrl,
  today,
  readOnly,
  busy,
  setBusy,
  onDone,
}: PhotoSheetProps & { photo: LibraryPhoto; busy: boolean; setBusy: (busy: boolean) => void; onDone: Done }) {
  const [step, setStep] = useState<"details" | "remove">("details");
  const [alt, setAlt] = useState(photo.alt);
  const [altError, setAltError] = useState<string | undefined>();
  const [place, setPlace] = useState(placementValue(photo));
  const [error, setError] = useState<string | null>(null);

  const eventMap = new Map<string, PlacedEvent>(events.map((event) => [event.id, event]));
  const small = photoUrl(supabaseUrl, photo.id, "sm", photo.mimeType);
  const large = photoUrl(supabaseUrl, photo.id, "lg", photo.mimeType);
  const changed = alt.trim() !== photo.alt || place !== placementValue(photo);
  const day = formatDayLabel(laDateOf(photo.createdAt), today);
  const added = day === "Today" || day === "Yesterday" ? day.toLowerCase() : `on ${day}`;
  const by = photo.uploadedBy ? names[photo.uploadedBy] : undefined;

  if (step === "remove") {
    return (
      <RemovePhoto
        photo={photo}
        thumbnail={small}
        takedowns={takedowns}
        takedownId={takedownId}
        today={today}
        readOnly={readOnly}
        busy={busy}
        setBusy={setBusy}
        onBack={() => setStep("details")}
        onDone={(result) => onDone(result, "removed")}
      />
    );
  }

  async function save() {
    const checked = checkAlt(alt);
    if (!checked.ok) {
      setAltError(checked.error);
      document.getElementById(ALT_ID)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    let result: PhotoActionResult;
    try {
      result = await savePhoto({ id: photo.id, alt: checked.alt, placement: place });
    } catch {
      result = { status: "failed", message: "Couldn't reach the portal. Check your connection and try again." };
    } finally {
      setBusy(false);
    }
    if (result.status === "failed") setError(result.message);
    else onDone(result, "saved");
  }

  return (
    <>
      <SheetHeader className="pr-12">
        <SheetTitle>Photo</SheetTitle>
        <SheetDescription>{by ? `Added ${added} by ${by}.` : `Added ${added}.`}</SheetDescription>
      </SheetHeader>

      <form
        className="space-y-4 px-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- already sized when it was uploaded */}
        <img
          src={large}
          srcSet={`${small} 640w, ${large} 1600w`}
          sizes="(min-width: 40rem) 36rem, 100vw"
          alt=""
          width={photo.width}
          height={photo.height}
          className="max-h-64 w-full rounded-lg bg-muted object-contain"
        />

        <FormField
          id={ALT_ID}
          label="Describe the photo"
          hint="What's happening, for screen readers and slow connections. Never name anyone in it."
          error={altError}
        >
          <Textarea
            id={ALT_ID}
            rows={2}
            autoCapitalize="sentences"
            maxLength={ALT_MAX}
            className="min-h-16"
            value={alt}
            disabled={readOnly}
            aria-invalid={altError ? true : undefined}
            aria-describedby={describedBy(ALT_ID, altError, true)}
            onChange={(event) => {
              setAlt(event.target.value);
              if (altError) setAltError(undefined);
            }}
          />
        </FormField>

        <FormField id={PLACE_ID} label="Where it shows" hint={placementNote(place, photo, photos, eventMap)}>
          <Select value={place} onValueChange={setPlace} disabled={readOnly}>
            <SelectTrigger
              id={PLACE_ID}
              aria-describedby={`${PLACE_ID}-hint`}
              className="w-full text-base data-[size=default]:h-11 desktop:text-sm"
            >
              <SelectValue>{placementLabel(place, eventMap)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={LIBRARY}>Not on the site</SelectItem>
              {spotsByPage().map(([page, spots]) => (
                <SelectGroup key={page}>
                  <SelectLabel>{page}</SelectLabel>
                  {spots.map(({ spot, label }) => (
                    <SelectItem key={spot} value={`spot:${spot}`}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
              {events.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Event covers</SelectLabel>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={`event:${event.id}`}>
                      {event.title}
                      <span className="text-muted-foreground">
                        {event.status === "draft" ? "Draft" : formatWeekdayDate(laDateOf(event.startsAt), today)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </FormField>

        {error && (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col-reverse gap-2 pt-2 desktop:flex-row desktop:justify-end">
          <SheetClose asChild>
            <Button type="button" variant="outline" className="h-11 px-5" disabled={busy}>
              Cancel
            </Button>
          </SheetClose>
          <Button type="submit" className="h-11 px-5" disabled={readOnly || busy || !changed}>
            {busy && <LoaderCircleIcon className="animate-spin" aria-hidden />}
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>

      <div className="space-y-3 px-4 pb-4">
        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="min-w-0 flex-1 basis-56 text-sm text-muted-foreground">
            Someone asked, or it shouldn&apos;t be up? Take it off the site and delete its files.
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-11 px-4 text-destructive hover:text-destructive"
            disabled={readOnly || busy}
            onClick={() => setStep("remove")}
          >
            <Trash2Icon aria-hidden />
            Take down…
          </Button>
        </div>
      </div>
    </>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CircleCheckIcon, ImagePlusIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import { describedBy, FormField } from "@/components/portal/form-field";
import { Alert, AlertDescription } from "@/components/portal/ui/alert";
import { Button } from "@/components/portal/ui/button";
import { ResponsiveSheetContent } from "@/components/portal/ui/responsive-sheet";
import { Sheet, SheetClose, SheetDescription, SheetHeader, SheetTitle } from "@/components/portal/ui/sheet";
import { Textarea } from "@/components/portal/ui/textarea";
import { UnusableFileError } from "@/lib/portal/images/canvas";
import { addPhoto } from "@/lib/portal/photos/actions";
import { processPhoto, type ProcessedPhoto } from "@/lib/portal/photos/compress";
import { ALT_MAX, checkAlt } from "@/lib/portal/photos/schema";
import { uploadPhoto, type UploadResult } from "@/lib/portal/photos/upload";
import { createClient } from "@/lib/supabase/client";

/** A picked photo, shrunk and shown while its alt text is written. */
type Draft = { photo: ProcessedPhoto; url: string };

type Busy = "processing" | "uploading" | null;

const ALT_ID = "photo-alt";

/**
 * The Photos header, with "Add photo" beside its title (`children`). It
 * picks a photo, shrinks it to the site's two sizes on the device, then
 * asks for alt text before uploading it to the library.
 */
export function PhotoUpload({ readOnly, children }: { readOnly: boolean; children: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [alt, setAlt] = useState("");
  const [altError, setAltError] = useState<string | undefined>();
  const [busy, setBusy] = useState<Busy>(null);
  // Why a pick or upload didn't work, or that it did.
  const [pickError, setPickError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    if (!draft) return;
    return () => URL.revokeObjectURL(draft.url);
  }, [draft]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy("processing");
    setPickError(null);
    setAdded(null);
    try {
      const photo = await processPhoto(file);
      setDraft({ photo, url: URL.createObjectURL(photo.files.lg) });
      setAlt("");
      setAltError(undefined);
      setUploadError(null);
    } catch (error) {
      const usable = error instanceof UnusableFileError;
      setPickError(usable ? error.message : "This photo couldn't be used. Try another one.");
    } finally {
      setBusy(null);
    }
  }

  async function upload() {
    if (!draft) return;
    const checked = checkAlt(alt);
    if (!checked.ok) {
      setAltError(checked.error);
      document.getElementById(ALT_ID)?.focus();
      return;
    }
    setBusy("uploading");
    setUploadError(null);
    let result: UploadResult;
    try {
      result = await uploadPhoto(createClient(), draft.photo, checked.alt, addPhoto);
    } catch {
      result = { status: "failed", message: "Couldn't upload the photo. Check your connection and try again." };
    } finally {
      setBusy(null);
    }
    if (result.status === "failed") {
      setUploadError(result.message);
      return;
    }
    setDraft(null);
    setAdded(result.message);
  }

  function close(open: boolean) {
    // An upload that's halfway through finishes first.
    if (!open && busy !== "uploading") setDraft(null);
  }

  return (
    <div className="space-y-3">
      <header className="flex items-start justify-between gap-4">
        {children}
        <Button
          type="button"
          className="h-11 shrink-0 px-5"
          disabled={readOnly || busy !== null}
          onClick={() => input.current?.click()}
        >
          {busy === "processing" ? (
            <LoaderCircleIcon className="animate-spin" aria-hidden />
          ) : (
            <ImagePlusIcon aria-hidden />
          )}
          {busy === "processing" ? "Preparing…" : "Add photo"}
        </Button>
      </header>

      <input
        ref={input}
        type="file"
        accept="image/*"
        // Not `hidden`: some iOS versions ignore clicks on a display:none file input.
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          void pick(event.target.files?.[0]);
          // Lets the same photo be picked again.
          event.target.value = "";
        }}
      />
      <Sheet open={draft !== null} onOpenChange={close}>
        <ResponsiveSheetContent
          onInteractOutside={(event) => {
            if (busy === "uploading") event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (busy === "uploading") event.preventDefault();
          }}
        >
          <SheetHeader className="pr-12">
            <SheetTitle>Add a photo</SheetTitle>
            <SheetDescription>
              It goes in the library. Nothing shows on the site until it&apos;s placed.
            </SheetDescription>
          </SheetHeader>

          {draft && (
            <form
              className="space-y-4 px-4"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void upload();
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- a local preview, not a page image */}
              <img
                src={draft.url}
                alt=""
                width={draft.photo.width}
                height={draft.photo.height}
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
                  placeholder="Students playing four square in the parking lot"
                  className="min-h-16"
                  value={alt}
                  aria-invalid={altError ? true : undefined}
                  aria-describedby={describedBy(ALT_ID, altError, true)}
                  onChange={(event) => {
                    setAlt(event.target.value);
                    if (altError) setAltError(undefined);
                  }}
                />
              </FormField>

              {uploadError && (
                <Alert variant="destructive">
                  <TriangleAlertIcon />
                  <AlertDescription>{uploadError}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col-reverse gap-2 pt-2 desktop:flex-row desktop:justify-end">
                <SheetClose asChild>
                  <Button type="button" variant="outline" className="h-11 px-5" disabled={busy === "uploading"}>
                    Cancel
                  </Button>
                </SheetClose>
                <Button type="submit" className="h-11 px-5" disabled={busy === "uploading"}>
                  {busy === "uploading" && <LoaderCircleIcon className="animate-spin" aria-hidden />}
                  {busy === "uploading" ? "Uploading…" : "Add to library"}
                </Button>
              </div>
            </form>
          )}
        </ResponsiveSheetContent>
      </Sheet>

      {pickError && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>{pickError}</AlertDescription>
        </Alert>
      )}
      {added && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheckIcon className="size-4 shrink-0" aria-hidden />
          {added}
        </p>
      )}
    </div>
  );
}

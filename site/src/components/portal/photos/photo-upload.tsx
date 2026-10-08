"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CircleCheckIcon, ImagePlusIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import { describedBy, FormField } from "@/components/portal/form-field";
import { Alert, AlertDescription } from "@/components/portal/ui/alert";
import { Button } from "@/components/portal/ui/button";
import { ResponsiveSheetContent } from "@/components/portal/ui/responsive-sheet";
import { Sheet, SheetClose, SheetDescription, SheetHeader, SheetTitle } from "@/components/portal/ui/sheet";
import { Textarea } from "@/components/portal/ui/textarea";
import type { PhotoType } from "@/lib/photo-files";
import { UnusableFileError } from "@/lib/portal/images/canvas";
import { addPhoto } from "@/lib/portal/photos/actions";
import { processPhoto, type ProcessedPhoto } from "@/lib/portal/photos/compress";
import { ALT_MAX, checkAlt } from "@/lib/portal/photos/schema";
import { uploadPhoto, type UploadResult } from "@/lib/portal/photos/upload";
import { createClient } from "@/lib/supabase/client";

/** A photo in the library, with what it takes to show it. */
export type AddedPhoto = { id: string; alt: string; width: number; height: number; mimeType: PhotoType };

/** A picked photo, shrunk and shown while its alt text is written. */
type Draft = { photo: ProcessedPhoto; url: string };

export type UploadBusy = "processing" | "uploading" | null;

/** What the uploader gives the button that starts it. */
export type UploadControls = {
  /** Opens the device's photo picker. */
  choose: () => void;
  busy: UploadBusy;
  /** Why the picked photo couldn't be used. */
  problem: string | null;
};

const ALT_ID = "photo-alt";

/**
 * Picks a photo, shrinks it to the site's two sizes on the device, then
 * asks for alt text before uploading it to the library. `children` draws
 * the button that starts it, and says when a photo couldn't be used.
 */
export function PhotoUploader({
  description,
  submitLabel,
  onAdded,
  children,
}: {
  /** Under the sheet's title: where the photo goes. */
  description: string;
  submitLabel: string;
  onAdded: (photo: AddedPhoto, message: string) => void;
  children: (controls: UploadControls) => ReactNode;
}) {
  // State, not a ref, since `children` gets a way to open it while rendering.
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [alt, setAlt] = useState("");
  const [altError, setAltError] = useState<string | undefined>();
  const [busy, setBusy] = useState<UploadBusy>(null);
  // Why a pick or upload didn't work.
  const [pickError, setPickError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!draft) return;
    return () => URL.revokeObjectURL(draft.url);
  }, [draft]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy("processing");
    setPickError(null);
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
    const { width, height, mimeType } = draft.photo;
    setDraft(null);
    onAdded({ id: result.id, alt: checked.alt, width, height, mimeType }, result.message);
  }

  function close(open: boolean) {
    // An upload that's halfway through finishes first.
    if (!open && busy !== "uploading") setDraft(null);
  }

  return (
    <>
      {children({ choose: () => input?.click(), busy, problem: pickError })}

      <input
        ref={setInput}
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
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>

          {draft && (
            <form
              className="space-y-4 px-4"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                // The sheet is portaled, but React still bubbles its submit to a form around the uploader.
                event.stopPropagation();
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
                  {busy === "uploading" ? "Uploading…" : submitLabel}
                </Button>
              </div>
            </form>
          )}
        </ResponsiveSheetContent>
      </Sheet>
    </>
  );
}

/** The icon for a button that starts an upload: a spinner while the photo is prepared. */
export function UploadIcon({ busy }: { busy: UploadBusy }) {
  return busy === "processing" ? (
    <LoaderCircleIcon className="animate-spin" aria-hidden />
  ) : (
    <ImagePlusIcon aria-hidden />
  );
}

/**
 * The Photos header, with "Add photo" beside its title (`children`). A new
 * photo goes in the library until it's placed.
 */
export function PhotoUpload({ readOnly, children }: { readOnly: boolean; children: ReactNode }) {
  const [added, setAdded] = useState<string | null>(null);

  return (
    <PhotoUploader
      description="It goes in the library. Nothing shows on the site until it's placed."
      submitLabel="Add to library"
      onAdded={(_, message) => setAdded(message)}
    >
      {({ choose, busy, problem }) => (
        <div className="space-y-3">
          <header className="flex items-start justify-between gap-4">
            {children}
            <Button
              type="button"
              className="h-11 shrink-0 px-5"
              disabled={readOnly || busy !== null}
              onClick={() => {
                setAdded(null);
                choose();
              }}
            >
              <UploadIcon busy={busy} />
              {busy === "processing" ? "Preparing…" : "Add photo"}
            </Button>
          </header>

          {problem && (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertDescription>{problem}</AlertDescription>
            </Alert>
          )}
          {added && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <CircleCheckIcon className="size-4 shrink-0" aria-hidden />
              {added}
            </p>
          )}
        </div>
      )}
    </PhotoUploader>
  );
}

"use client";

import { useState } from "react";
import { ImagesIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { FormField } from "@/components/portal/form-field";
import { PhotoUploader, UploadIcon, type AddedPhoto } from "@/components/portal/photos/photo-upload";
import { Alert, AlertDescription } from "@/components/portal/ui/alert";
import { Button } from "@/components/portal/ui/button";
import { ResponsiveSheetContent } from "@/components/portal/ui/responsive-sheet";
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from "@/components/portal/ui/sheet";
import { photoUrl } from "@/lib/photo-files";

const ID = "post-photo";
const HINT =
  "It shows on the heads-up's card and on Home. Without one, a heads-up that links to an event shows the event's cover.";

/**
 * The heads-up's photo: upload a new one, or choose one from the library
 * that isn't on the site. It goes on when the heads-up is saved.
 */
export function PostPhoto({
  photo,
  choices,
  supabaseUrl,
  disabled,
  onChange,
}: {
  photo: AddedPhoto | null;
  /** Library photos it can take. The one it has is left out here. */
  choices: readonly AddedPhoto[];
  supabaseUrl: string;
  disabled: boolean;
  onChange: (photo: AddedPhoto | null) => void;
}) {
  const [browsing, setBrowsing] = useState(false);
  const library = choices.filter(({ id }) => id !== photo?.id);

  return (
    <FormField id={ID} label="Photo" optional group hint={HINT}>
      <div role="group" aria-labelledby={`${ID}-label`} aria-describedby={`${ID}-hint`} className="space-y-2">
        <PhotoUploader
          description="It goes on this heads-up when you save, and in the library on the Photos screen."
          submitLabel="Add photo"
          onAdded={(added) => onChange(added)}
        >
          {({ choose, busy, problem }) => (
            <>
              {photo && (
                <div className="flex items-center gap-3 rounded-xl border bg-card p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- already sized when it was uploaded */}
                  <img
                    src={photoUrl(supabaseUrl, photo.id, "sm", photo.mimeType)}
                    alt=""
                    width={photo.width}
                    height={photo.height}
                    className="aspect-4/3 w-24 shrink-0 rounded-lg bg-muted object-cover"
                  />
                  <p className="line-clamp-3 min-w-0 flex-1 text-sm text-muted-foreground">{photo.alt}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 shrink-0"
                    disabled={disabled || busy !== null}
                    onClick={() => onChange(null)}
                  >
                    <XIcon aria-hidden />
                    <span className="sr-only">Remove the photo</span>
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 px-4"
                  disabled={disabled || busy !== null}
                  onClick={choose}
                >
                  <UploadIcon busy={busy} />
                  {busy === "processing" ? "Preparing…" : photo ? "Upload another" : "Upload"}
                </Button>
                {library.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 px-4"
                    disabled={disabled || busy !== null}
                    onClick={() => setBrowsing(true)}
                  >
                    <ImagesIcon aria-hidden />
                    Choose from library
                  </Button>
                )}
              </div>

              {problem && (
                <Alert variant="destructive">
                  <TriangleAlertIcon />
                  <AlertDescription>{problem}</AlertDescription>
                </Alert>
              )}
            </>
          )}
        </PhotoUploader>
      </div>

      <Sheet open={browsing} onOpenChange={setBrowsing}>
        <ResponsiveSheetContent>
          <SheetHeader className="pr-12">
            <SheetTitle>Choose a photo</SheetTitle>
            <SheetDescription>Photos in the library that aren&apos;t on the site.</SheetDescription>
          </SheetHeader>
          <ul className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3" aria-label="Library photos">
            {library.map((choice) => (
              <li key={choice.id} className="min-w-0">
                <button
                  type="button"
                  aria-label={choice.alt}
                  className="group block w-full space-y-1.5 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  onClick={() => {
                    onChange(choice);
                    setBrowsing(false);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- already sized when it was uploaded */}
                  <img
                    src={photoUrl(supabaseUrl, choice.id, "sm", choice.mimeType)}
                    alt=""
                    width={choice.width}
                    height={choice.height}
                    loading="lazy"
                    decoding="async"
                    className="aspect-4/3 w-full rounded-lg bg-muted object-cover transition-opacity group-hover:opacity-90"
                  />
                  <p className="line-clamp-2 text-xs text-muted-foreground">{choice.alt}</p>
                </button>
              </li>
            ))}
          </ul>
        </ResponsiveSheetContent>
      </Sheet>
    </FormField>
  );
}

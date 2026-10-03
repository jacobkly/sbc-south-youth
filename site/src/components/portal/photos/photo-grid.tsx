"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, CircleCheckIcon, TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/portal/ui/alert";
import { Badge } from "@/components/portal/ui/badge";
import { Button } from "@/components/portal/ui/button";
import { photoUrl } from "@/lib/photo-files";
import { placementBadge, type PlacedEvent } from "@/lib/portal/photos/placement";
import type { LibraryPhoto } from "@/lib/portal/photos/queries";
import type { RemovalResult } from "@/lib/portal/photos/schema";
import type { PhotoActionResult } from "@/lib/portal/photos/upload";
import { PhotoSheet, type PhotoSheetProps } from "./photo-sheet";

type Notice = { kind: "saved" | "removed" | "files_left"; text: string };

/**
 * The library: each photo's small size with its alt text, and a badge for
 * where it shows. Tapping one opens it to edit or take down.
 */
export function PhotoGrid(props: PhotoSheetProps) {
  const { photos, events, takedownId, supabaseUrl } = props;
  // The open photo is kept while the sheet closes, even once it's out of the library.
  const [selected, setSelected] = useState<LibraryPhoto | null>(null);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const removed = useRef(false);
  const noticeRef = useRef<HTMLDivElement>(null);

  const eventMap = new Map<string, PlacedEvent>(events.map((event) => [event.id, event]));

  function done(result: PhotoActionResult | RemovalResult, kind: "saved" | "removed") {
    setNotice({ kind: result.status === "files_left" ? "files_left" : kind, text: result.message });
    removed.current = kind === "removed";
    setOpen(false);
  }

  return (
    <section aria-labelledby="library-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="library-heading" className="text-lg font-semibold">
          Library
        </h2>
        <p className="text-sm text-muted-foreground">
          Tap a photo to describe it, put it on the site, or take it down.
        </p>
      </div>

      <div ref={noticeRef} tabIndex={-1} className="outline-none empty:hidden">
        {notice?.kind === "files_left" ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>{notice.text}</AlertDescription>
          </Alert>
        ) : (
          notice && (
            <div role="status" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <CircleCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                {notice.text}
              </p>
              {notice.kind === "removed" && takedownId && (
                <Button asChild variant="outline" className="h-11 px-4">
                  <Link href={`/messages/${takedownId}`}>
                    <ArrowLeftIcon aria-hidden />
                    Back to the request
                  </Link>
                </Button>
              )}
            </div>
          )
        )}
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Photos">
        {photos.map((photo) => {
          const badge = placementBadge(photo, eventMap);
          return (
            <li key={photo.id} className="min-w-0">
              <button
                type="button"
                aria-label={badge ? `${photo.alt}. ${badge}` : photo.alt}
                className="group relative block w-full space-y-1.5 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  setSelected(photo);
                  setNotice(null);
                  setOpen(true);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- already sized when it was uploaded */}
                <img
                  src={photoUrl(supabaseUrl, photo.id, "sm", photo.mimeType)}
                  alt=""
                  width={photo.width}
                  height={photo.height}
                  loading="lazy"
                  decoding="async"
                  className="aspect-4/3 w-full rounded-lg bg-muted object-cover transition-opacity group-hover:opacity-90"
                />
                <p className="line-clamp-2 text-xs text-muted-foreground">{photo.alt}</p>
                {badge && (
                  <Badge className="absolute top-2 left-2 max-w-[calc(100%-1rem)] truncate shadow-sm">{badge}</Badge>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <PhotoSheet
        {...props}
        photo={selected}
        open={open}
        onOpenChange={setOpen}
        onDone={done}
        onCloseAutoFocus={(event) => {
          // A photo that came down has no tile left to go back to.
          event.preventDefault();
          if (removed.current || !opener.current?.isConnected) noticeRef.current?.focus();
          else opener.current.focus();
          removed.current = false;
        }}
      />
    </section>
  );
}

"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const ZOOMS = [1, 2, 4] as const;
const SELECTED = "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground hover:data-[state=on]:bg-primary/90";

/**
 * Full-screen view of one receipt image, with zoom steps for checking
 * small print. The image scrolls in both directions once zoomed.
 */
export function ReceiptViewer({
  name,
  url,
  width,
  height,
  onClose,
}: {
  name: string;
  url: string;
  width: number;
  height: number;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState<number>(1);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 ring-0 sm:max-w-none"
      >
        <div className="flex items-center gap-2 border-b pt-[max(0.5rem,env(safe-area-inset-top))] pr-2 pb-2 pl-4">
          <DialogTitle className="min-w-0 flex-1 truncate">{name}</DialogTitle>
          <DialogDescription className="sr-only">Zoom in to check that the receipt is readable.</DialogDescription>
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            value={String(zoom)}
            onValueChange={(value) => value && setZoom(Number(value))}
            aria-label="Zoom"
          >
            {ZOOMS.map((level) => (
              <ToggleGroupItem key={level} value={String(level)} className={`h-10 min-w-11 px-3 ${SELECTED}`}>
                {level === 1 ? "Fit" : `${level}×`}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="size-11" aria-label="Close">
              <XIcon />
            </Button>
          </DialogClose>
        </div>

        <div
          tabIndex={0}
          aria-label="Receipt image, scrollable"
          className="min-h-0 flex-1 overflow-auto overscroll-contain bg-muted pb-[env(safe-area-inset-bottom)] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          {/* Blob and signed URLs, so next/image doesn't apply. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            width={width}
            height={height}
            alt={`Receipt: ${name}`}
            draggable={false}
            className={zoom === 1 ? "mx-auto h-full w-auto max-w-full object-contain" : "h-auto max-w-none"}
            style={zoom === 1 ? undefined : { width: `${zoom * 100}%` }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

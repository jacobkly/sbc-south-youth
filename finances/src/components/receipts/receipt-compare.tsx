"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type CompareImage = { url: string; width: number; height: number; label: string };

type View = "both" | "compressed" | "original";

const ZOOMS = [1, 2, 4, 8] as const;
const SELECTED = "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground hover:data-[state=on]:bg-primary/90";

/**
 * Full-screen comparison of an original photo and its compressed version.
 * Both panes zoom and scroll together, so the same spot on the receipt
 * stays lined up. Stacked on phones, side by side on wider screens.
 */
export function ReceiptCompare({
  name,
  original,
  compressed,
  onClose,
}: {
  name: string;
  original: CompareImage;
  compressed: CompareImage;
  onClose: () => void;
}) {
  const [view, setView] = useState<View>("both");
  const [zoom, setZoom] = useState<number>(2);
  const panes = useRef(new Map<string, HTMLDivElement>());
  // Scroll position as a fraction of the scrollable range, shared by both panes.
  const position = useRef({ x: 0, y: 0 });
  // Only the pane the user is touching drives the other one. Syncing both
  // ways would echo back and cut off iOS momentum scrolling.
  const driver = useRef<string | null>(null);

  function applyPosition(el: HTMLDivElement) {
    el.scrollLeft = position.current.x * (el.scrollWidth - el.clientWidth);
    el.scrollTop = position.current.y * (el.scrollHeight - el.clientHeight);
  }

  function handleScroll(key: string) {
    const el = panes.current.get(key);
    if (driver.current !== key || !el) return;

    position.current = {
      x: el.scrollLeft / Math.max(1, el.scrollWidth - el.clientWidth),
      y: el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight),
    };
    for (const [otherKey, other] of panes.current) {
      if (otherKey !== key) applyPosition(other);
    }
  }

  // Keep the same spot in view after zooming.
  useLayoutEffect(() => {
    for (const el of panes.current.values()) applyPosition(el);
  }, [zoom]);

  function registerPane(key: string) {
    return (el: HTMLDivElement) => {
      panes.current.set(key, el);
      applyPosition(el);
      return () => {
        panes.current.delete(key);
      };
    };
  }

  const shown = [
    view !== "compressed" && { key: "original", image: original },
    view !== "original" && { key: "compressed", image: compressed },
  ].filter((pane) => pane !== false);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 ring-0 sm:max-w-none"
      >
        <div className="flex items-center gap-2 border-b pt-[max(0.5rem,env(safe-area-inset-top))] pr-2 pb-2 pl-4">
          <DialogTitle className="min-w-0 flex-1 truncate">{name}</DialogTitle>
          <DialogDescription className="sr-only">
            Compare the original photo with the compressed version. Both views zoom and scroll together.
          </DialogDescription>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="size-11" aria-label="Close">
              <XIcon />
            </Button>
          </DialogClose>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            value={view}
            onValueChange={(value) => value && setView(value as View)}
            aria-label="Which image to show"
          >
            <ToggleGroupItem value="both" className={`h-10 px-3 ${SELECTED}`}>
              Both
            </ToggleGroupItem>
            <ToggleGroupItem value="compressed" className={`h-10 px-3 ${SELECTED}`}>
              Compressed
            </ToggleGroupItem>
            <ToggleGroupItem value="original" className={`h-10 px-3 ${SELECTED}`}>
              Original
            </ToggleGroupItem>
          </ToggleGroup>
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
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-px bg-border md:flex-row">
          {shown.map(({ key, image }) => (
            <div key={key} className="relative min-h-0 min-w-0 flex-1 bg-muted">
              <div
                ref={registerPane(key)}
                onScroll={() => handleScroll(key)}
                onPointerDown={() => (driver.current = key)}
                onWheel={() => (driver.current = key)}
                onKeyDown={() => (driver.current = key)}
                tabIndex={0}
                aria-label={`${image.label} image, scrollable`}
                className="absolute inset-0 overflow-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                {/* Blob URLs of local files, so next/image doesn't apply. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  width={image.width}
                  height={image.height}
                  alt={`${image.label} receipt`}
                  draggable={false}
                  className="h-auto max-w-none"
                  style={{ width: `${zoom * 100}%` }}
                />
              </div>
              <span className="pointer-events-none absolute top-2 left-2 rounded-md bg-background/90 px-2 py-1 text-xs font-medium shadow-sm">
                {image.label} · {image.width}×{image.height}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

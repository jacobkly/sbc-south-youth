"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { cn } from "cn";
import { LoaderCircleIcon, MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  clampView,
  doubleTapView,
  FIT,
  fitSize,
  MAX_SCALE,
  onImage,
  pinchOf,
  pinchView,
  zoomBy,
  type Pinch,
  type Point,
  type Size,
  type View,
} from "@/lib/receipts/zoom";

/** How far a finger can drift and still count as a tap. */
const TAP_SLOP = 10;
/** How long to wait for a second tap before acting on the first. */
const DOUBLE_TAP_MS = 300;
/** How much the +/− buttons and keys zoom each press. */
const STEP = 1.5;
/** How far an arrow key pans. */
const ARROW_PAN = 80;
const CENTER: Point = { x: 0, y: 0 };

const ARROWS: Record<string, Point> = {
  ArrowLeft: { x: ARROW_PAN, y: 0 },
  ArrowRight: { x: -ARROW_PAN, y: 0 },
  ArrowUp: { x: 0, y: ARROW_PAN },
  ArrowDown: { x: 0, y: -ARROW_PAN },
};

const OVERLAY = "pointer-events-none absolute inset-x-0 transition-[opacity,visibility] duration-200";
const OVERLAY_HIDDEN = "invisible opacity-0";
const OVERLAY_BUTTON =
  "pointer-events-auto size-11 rounded-full text-white hover:bg-white/15 hover:text-white focus-visible:border-white/60 focus-visible:ring-white/40 disabled:opacity-40 dark:hover:bg-white/15";

/** The pan or pinch in progress: the view and fingers when it started. */
type Gesture = { start: View; from: Pinch; tap: Point | null; pinched: boolean };

/**
 * Full-screen view of one receipt image on black. Pinch, double-tap, or
 * scroll to zoom and drag to pan, all inside the viewer, so the page itself
 * never zooms. Tapping the image shows or hides the title and buttons, and
 * tapping the black around it closes the viewer, like Esc and the X.
 */
export function ReceiptViewer({
  title,
  url,
  width,
  height,
  onClose,
}: {
  title: string;
  url: string;
  /** Unknown for older receipts, which are measured once they load. */
  width: number | null;
  height: number | null;
  onClose: () => void;
}) {
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  const [stage, setStage] = useState<Size | null>(null);
  const [measured, setMeasured] = useState<Size | null>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const [view, setView] = useState<View>(FIT);
  const [animate, setAnimate] = useState(false);
  const [chrome, setChrome] = useState(true);

  // Handlers can run several times between renders, so they read these.
  const viewRef = useRef<View>(FIT);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const pendingTap = useRef<{ point: Point; timer: number } | null>(null);
  // There's no DialogTrigger, so the dialog can't find the tile that opened it.
  const opener = useRef<HTMLElement | null>(null);

  const natural = width && height ? { width, height } : measured;
  const fit = natural && stage && status === "loaded" ? fitSize(natural, stage) : null;
  const zoomed = view.scale > 1;

  function show(next: View, animated = false) {
    viewRef.current = next;
    setView(next);
    setAnimate(animated);
  }

  function stagePoint(target: Element, clientX: number, clientY: number): Point {
    const rect = target.getBoundingClientRect();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  }

  /** Starts the gesture over from the fingers now down, like when one of two lifts. */
  function rebase() {
    const [a, b] = pointers.current.values();
    if (!gesture.current || !a) return;
    gesture.current.start = viewRef.current;
    gesture.current.from = b ? pinchOf(a, b) : { mid: a, distance: 0 };
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = stagePoint(event.currentTarget, event.clientX, event.clientY);
    pointers.current.set(event.pointerId, point);

    if (pointers.current.size === 1) {
      gesture.current = { start: viewRef.current, from: { mid: point, distance: 0 }, tap: point, pinched: false };
    } else if (gesture.current) {
      gesture.current.tap = null;
      gesture.current.pinched = true;
      rebase();
    }
    setAnimate(false);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || !pointers.current.has(event.pointerId)) return;
    const point = stagePoint(event.currentTarget, event.clientX, event.clientY);
    pointers.current.set(event.pointerId, point);
    if (g.tap && Math.hypot(point.x - g.tap.x, point.y - g.tap.y) > TAP_SLOP) g.tap = null;
    if (!fit || !stage) return;

    const [a, b] = pointers.current.values();
    if (b) {
      // A little give past the limits while pinching, then it settles back.
      show(clampView(pinchView(g.start, g.from, pinchOf(a, b)), fit, stage, 0.75, MAX_SCALE * 1.25));
    } else if (g.start.scale > 1) {
      show(clampView({ ...g.start, x: g.start.x + a.x - g.from.mid.x, y: g.start.y + a.y - g.from.mid.y }, fit, stage));
    }
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.delete(event.pointerId)) return;
    const g = gesture.current;
    if (pointers.current.size > 0) {
      rebase();
      return;
    }
    gesture.current = null;
    if (g?.pinched && fit && stage) show(clampView(viewRef.current, fit, stage), true);
    else if (g?.tap && event.type === "pointerup") tapped(g.tap);
  }

  function tapped(point: Point) {
    const first = pendingTap.current;
    if (first && Math.hypot(point.x - first.point.x, point.y - first.point.y) < TAP_SLOP * 4) {
      window.clearTimeout(first.timer);
      pendingTap.current = null;
      if (fit && stage) show(doubleTapView(viewRef.current, point, fit, stage), true);
      return;
    }

    const hitImage = fit !== null && onImage(viewRef.current, point, fit);
    const timer = window.setTimeout(() => {
      pendingTap.current = null;
      if (hitImage) setChrome((shown) => !shown);
      else onClose();
    }, DOUBLE_TAP_MS);
    pendingTap.current = { point, timer };
  }

  function zoomStep(factor: number) {
    if (fit && stage) show(zoomBy(viewRef.current, factor, CENTER, fit, stage), true);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!fit || !stage || event.metaKey || event.ctrlKey || event.altKey) return;
    const pan = ARROWS[event.key];
    if (event.key === "+" || event.key === "=") zoomStep(STEP);
    else if (event.key === "-") zoomStep(1 / STEP);
    else if (event.key === "0") show(FIT, true);
    else if (pan && zoomed) {
      const current = viewRef.current;
      show(clampView({ ...current, x: current.x + pan.x, y: current.y + pan.y }, fit, stage), true);
    } else return;
    event.preventDefault();
  }

  // React's wheel listener is passive, and a trackpad pinch (ctrl + wheel)
  // would zoom the whole page unless it's stopped here.
  const onWheel = useEffectEvent((event: WheelEvent) => {
    event.preventDefault();
    if (!fit || !stage) return;
    const lines = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;
    const factor = Math.exp(-event.deltaY * lines * (event.ctrlKey ? 0.01 : 0.002));
    show(zoomBy(viewRef.current, factor, stagePoint(event.currentTarget as Element, event.clientX, event.clientY), fit, stage));
  });

  // Turning the phone or resizing the window starts again from fit.
  const onResize = useEffectEvent((size: Size) => {
    if (stage && (stage.width !== size.width || stage.height !== size.height)) show(FIT);
    setStage(size);
  });

  useEffect(() => {
    if (!stageEl) return;
    const observer = new ResizeObserver(([entry]) => {
      onResize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    const wheel = (event: WheelEvent) => onWheel(event);
    observer.observe(stageEl);
    stageEl.addEventListener("wheel", wheel, { passive: false });
    return () => {
      observer.disconnect();
      stageEl.removeEventListener("wheel", wheel);
    };
  }, [stageEl]);

  useEffect(() => {
    // Safari's own pinch zoom, in case a pinch starts on the title or buttons.
    const stopPageZoom = (event: Event) => event.preventDefault();
    document.addEventListener("gesturestart", stopPageZoom);
    const taps = pendingTap;
    return () => {
      document.removeEventListener("gesturestart", stopPageZoom);
      if (taps.current) window.clearTimeout(taps.current.timer);
    };
  }, []);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        onKeyDown={onKeyDown}
        onOpenAutoFocus={() => {
          if (document.activeElement instanceof HTMLElement) opener.current = document.activeElement;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          opener.current?.focus();
        }}
        className="top-0 left-0 block h-dvh w-screen max-w-none translate-x-0 translate-y-0 touch-none overflow-hidden rounded-none bg-black p-0 text-white ring-0 select-none sm:max-w-none"
      >
        <div
          ref={setStageEl}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          className={cn("absolute inset-0", zoomed && "cursor-grab active:cursor-grabbing")}
        >
          {status !== "failed" && (
            // Blob and signed URLs, so next/image doesn't apply.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={title}
              draggable={false}
              onLoad={(event) => {
                const img = event.currentTarget;
                setMeasured({ width: img.naturalWidth, height: img.naturalHeight });
                setStatus("loaded");
              }}
              onError={() => setStatus("failed")}
              // Sized rather than scaled with a transform, so zoomed-in text is drawn sharp.
              className={cn(
                "absolute max-w-none",
                !fit && "invisible",
                animate && "transition-[left,top,width,height] duration-250 ease-out motion-reduce:transition-none",
              )}
              style={
                fit && stage
                  ? {
                      left: stage.width / 2 + view.x - (fit.width * view.scale) / 2,
                      top: stage.height / 2 + view.y - (fit.height * view.scale) / 2,
                      width: fit.width * view.scale,
                      height: fit.height * view.scale,
                    }
                  : undefined
              }
            />
          )}
          {status === "loading" && (
            <LoaderCircleIcon
              className="absolute top-1/2 left-1/2 size-8 -translate-1/2 animate-spin text-white/70"
              aria-label="Loading the receipt"
            />
          )}
          {status === "failed" && (
            <p role="alert" className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-sm text-white/80">
              Couldn&apos;t load this receipt. Close it and try again.
            </p>
          )}
        </div>

        <div
          className={cn(
            OVERLAY,
            "top-0 flex items-center gap-2 bg-linear-to-b from-black/75 via-black/40 to-transparent pt-[max(0.5rem,env(safe-area-inset-top))] pr-2 pb-12 pl-4",
            !chrome && OVERLAY_HIDDEN,
          )}
        >
          <DialogTitle className="min-w-0 flex-1 truncate leading-6 text-white">{title}</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className={OVERLAY_BUTTON} aria-label="Close">
              <XIcon className="size-5" />
            </Button>
          </DialogClose>
        </div>
        <DialogDescription className="sr-only">
          Pinch, double-tap, or scroll to zoom. Tap outside the receipt to close.
        </DialogDescription>

        {/* Phones pinch, so the buttons are only for a mouse or trackpad. */}
        <div
          className={cn(
            OVERLAY,
            "bottom-0 hidden justify-center pb-[max(1.5rem,env(safe-area-inset-bottom))] desktop:flex",
            !chrome && OVERLAY_HIDDEN,
          )}
        >
          <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/70 p-1 ring-1 ring-white/15">
            <Button
              variant="ghost"
              size="icon"
              className={OVERLAY_BUTTON}
              aria-label="Zoom out"
              disabled={!fit || view.scale <= 1}
              onClick={() => zoomStep(1 / STEP)}
            >
              <MinusIcon />
            </Button>
            <Button
              variant="ghost"
              className={cn(OVERLAY_BUTTON, "w-auto min-w-16 px-3 tabular-nums")}
              aria-label={`${Math.round(view.scale * 100)}%, fit to screen`}
              disabled={!fit || view.scale === 1}
              onClick={() => show(FIT, true)}
            >
              {Math.round(view.scale * 100)}%
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={OVERLAY_BUTTON}
              aria-label="Zoom in"
              disabled={!fit || view.scale >= MAX_SCALE}
              onClick={() => zoomStep(STEP)}
            >
              <PlusIcon />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

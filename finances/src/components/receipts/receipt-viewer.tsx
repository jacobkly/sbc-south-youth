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
import { ChevronLeftIcon, ChevronRightIcon, LoaderCircleIcon, MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { releaseVelocity, swipeOffset, swipeStep, type Sample } from "@/lib/receipts/swipe";
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
/** How much of a drag to keep, to tell a flick from a careful drag. */
const SAMPLE_MS = 100;

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
// aria-disabled rather than disabled at the ends, so a focused button keeps focus and the arrow keys keep working.
const SIDE_BUTTON =
  "bg-black/50 ring-1 ring-white/15 aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-black/50 dark:bg-black/50 dark:aria-disabled:hover:bg-black/50 touch:sr-only";

/** 1 for the next receipt, -1 for the previous one. */
type Direction = 1 | -1;

/**
 * The pan, pinch, or swipe in progress: the view and fingers when it
 * started, and where the finger has been lately.
 */
type Gesture = { start: View; from: Pinch; tap: Point | null; pinched: boolean; samples: Sample[] };

/**
 * Full-screen view of a receipt image on black. Pinch, double-tap, or
 * scroll to zoom and drag to pan, all inside the viewer, so the page itself
 * never zooms. Tapping the image shows or hides the title and buttons, and
 * tapping the black around it closes the viewer, like Esc and the X. With
 * more than one receipt, swipe or use the arrow keys to step through them.
 */
export function ReceiptViewer({
  title,
  url,
  width,
  height,
  onPrevious,
  onNext,
  onClose,
}: {
  title: string;
  url: string;
  /** Unknown for older receipts, which are measured once they load. */
  width: number | null;
  height: number | null;
  /** Shows the receipt before this one. Left out for the first. */
  onPrevious?: () => void;
  /** Shows the receipt after this one. Left out for the last. */
  onNext?: () => void;
  onClose: () => void;
}) {
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  const [stage, setStage] = useState<Size | null>(null);
  // By URL, so stepping to another receipt starts out loading.
  const [loaded, setLoaded] = useState<{ url: string; size: Size } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [view, setView] = useState<View>(FIT);
  const [animate, setAnimate] = useState(false);
  const [chrome, setChrome] = useState(true);
  // The receipt just stepped away from, so the new one slides in from the side it came from.
  const [entered, setEntered] = useState<{ from: string; direction: Direction } | null>(null);

  // Handlers can run several times between renders, so they read these.
  const viewRef = useRef<View>(FIT);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const pendingTap = useRef<{ point: Point; timer: number } | null>(null);
  // There's no DialogTrigger, so the dialog can't find the tile that opened it.
  const opener = useRef<HTMLElement | null>(null);

  const status = failed === url ? "failed" : loaded?.url === url ? "loaded" : "loading";
  const natural = width && height ? { width, height } : loaded?.url === url ? loaded.size : null;
  const fit = natural && stage && status === "loaded" ? fitSize(natural, stage) : null;
  const zoomed = view.scale > 1;
  const sides = { previous: Boolean(onPrevious), next: Boolean(onNext) };
  const several = sides.previous || sides.next;
  const sliding = fit && entered && entered.from !== url ? entered.direction : 0;

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
      gesture.current = {
        start: viewRef.current,
        from: { mid: point, distance: 0 },
        tap: point,
        pinched: false,
        samples: [{ x: point.x, t: event.timeStamp }],
      };
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
    g.samples = [...g.samples.filter((sample) => event.timeStamp - sample.t <= SAMPLE_MS), { x: point.x, t: event.timeStamp }];
    if (!stage) return;

    const [a, b] = pointers.current.values();
    if (b) {
      // A little give past the limits while pinching, then it settles back.
      if (fit) show(clampView(pinchView(g.start, g.from, pinchOf(a, b)), fit, stage, 0.75, MAX_SCALE * 1.25));
    } else if (g.start.scale > 1) {
      if (fit) show(clampView({ ...g.start, x: g.start.x + a.x - g.from.mid.x, y: g.start.y + a.y - g.from.mid.y }, fit, stage));
    } else if (several && !g.pinched) {
      // At fit, a sideways drag carries the receipt with the finger, even while it loads.
      show({ ...FIT, x: swipeOffset(a.x - g.from.mid.x, stage.width, sides) });
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
    if (!g) return;
    if (g.pinched) {
      if (fit && stage) show(clampView(viewRef.current, fit, stage), true);
      return;
    }

    const swiped = g.start.scale <= 1 && viewRef.current.x !== 0;
    if (g.tap) {
      if (swiped) show(FIT, true);
      if (event.type === "pointerup") tapped(g.tap);
      return;
    }
    if (!swiped || !stage) return;
    if (event.type === "pointerup") {
      const point = stagePoint(event.currentTarget, event.clientX, event.clientY);
      const drag = { x: point.x - g.from.mid.x, y: point.y - g.from.mid.y };
      const direction = swipeStep(drag, releaseVelocity(g.samples, event.timeStamp), stage.width, sides);
      if (direction) {
        step(direction);
        return;
      }
    }
    show(FIT, true);
  }

  function step(direction: Direction) {
    const go = direction === 1 ? onNext : onPrevious;
    if (!go) return;
    show(FIT);
    // One that failed gets another try when it comes back around.
    setFailed(null);
    setEntered({ from: url, direction });
    go();
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
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    // Zoomed in, the arrows pan instead.
    if (several && !zoomed && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      step(event.key === "ArrowRight" ? 1 : -1);
      return;
    }
    if (!fit || !stage) return;
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
              // A new element for each receipt, so the last one never shows at the new one's size.
              key={url}
              src={url}
              alt={title}
              draggable={false}
              onLoad={(event) => {
                const img = event.currentTarget;
                setLoaded({ url, size: { width: img.naturalWidth, height: img.naturalHeight } });
              }}
              onError={() => setFailed(url)}
              onAnimationEnd={() => setEntered(null)}
              // Sized rather than scaled with a transform, so zoomed-in text is drawn sharp.
              className={cn(
                "absolute max-w-none",
                !fit && "invisible",
                animate && "transition-[left,top,width,height] duration-250 ease-out motion-reduce:transition-none",
                sliding !== 0 && "animate-in duration-250 ease-out fade-in motion-reduce:animate-none",
                sliding === 1 && "slide-in-from-right-12",
                sliding === -1 && "slide-in-from-left-12",
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
          {/* Live, so a screen reader hears which receipt it stepped to. */}
          <DialogTitle aria-live="polite" className="min-w-0 flex-1 truncate leading-6 text-white">
            {title}
          </DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className={OVERLAY_BUTTON} aria-label="Close">
              <XIcon className="size-5" />
            </Button>
          </DialogClose>
        </div>
        <DialogDescription className="sr-only">
          Pinch, double-tap, or scroll to zoom.
          {several && " Swipe or use the arrow keys to see the other receipts."} Tap outside the receipt to close.
        </DialogDescription>

        {/* Phones swipe, so there these are only for screen readers. */}
        {several && (
          <div className={cn(OVERLAY, "top-1/2 flex -translate-y-1/2 justify-between px-2", !chrome && OVERLAY_HIDDEN)}>
            <Button
              variant="ghost"
              size="icon"
              className={cn(OVERLAY_BUTTON, SIDE_BUTTON)}
              aria-label="Previous receipt"
              aria-disabled={!onPrevious}
              onClick={() => step(-1)}
            >
              <ChevronLeftIcon className="size-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(OVERLAY_BUTTON, SIDE_BUTTON)}
              aria-label="Next receipt"
              aria-disabled={!onNext}
              onClick={() => step(1)}
            >
              <ChevronRightIcon className="size-6" />
            </Button>
          </div>
        )}

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

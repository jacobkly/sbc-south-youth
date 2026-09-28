"use client";

import { ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { MouseEvent, PointerEvent, SyntheticEvent } from "react";
import { SocialIcon } from "@/components/icons/social-icon";
import { site } from "@/content/site";
import { isActive } from "@/lib/nav";
import { moreItems } from "./nav-items";

// Movement before a press counts as a drag, so taps still reach the links.
const DRAG_START_PX = 6;
// A drag closes the sheet past this distance, or when flicked this fast.
const CLOSE_DISTANCE_PX = 96;
const CLOSE_VELOCITY_PX_PER_MS = 0.6;
// Longest the slide-out can take before the dialog closes anyway.
const CLOSE_FALLBACK_MS = 700;

type Drag = {
  pointerId: number;
  startY: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  active: boolean;
};

/**
 * The phone's More menu, a bottom sheet on a native modal `<dialog>`, which
 * brings the focus trap, Escape, and focus return. It slides with CSS (see
 * `.sheet` in globals.css) and closes by the X, Escape, a tap outside, or
 * dragging it down.
 */
export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const draggedRef = useRef(false);
  const pathname = usePathname();

  useEffect(() => {
    const dialog = dialogRef.current;
    const sheet = sheetRef.current;
    if (!dialog || !sheet) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (!dialog.open) return;

    // Let the slide-out finish, then close the dialog. The timer covers a
    // transition that never ends, like one in a background tab.
    const close = () => dialog.close();
    if (parseFloat(getComputedStyle(sheet).transitionDuration) === 0) {
      close();
      return;
    }
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target === sheet) close();
    };
    sheet.addEventListener("transitionend", onTransitionEnd);
    const timer = window.setTimeout(close, CLOSE_FALLBACK_MS);
    return () => {
      sheet.removeEventListener("transitionend", onTransitionEnd);
      window.clearTimeout(timer);
    };
  }, [open]);

  // Escape plays the slide-out instead of closing at once.
  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    onClose();
  }

  // The dialog fills the screen, so a click on it and not the sheet is a tap outside.
  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    draggedRef.current = false;
    if (!event.isPrimary || event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocity: 0,
      active: false,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const sheet = sheetRef.current;
    if (!drag || !sheet || event.pointerId !== drag.pointerId) return;

    const offset = event.clientY - drag.startY;
    if (!drag.active) {
      if (Math.abs(offset) < DRAG_START_PX) return;
      drag.active = true;
      draggedRef.current = true;
      sheet.dataset.dragging = "";
      sheet.setPointerCapture(event.pointerId);
    }

    const elapsed = event.timeStamp - drag.lastTime;
    if (elapsed > 0) drag.velocity = (event.clientY - drag.lastY) / elapsed;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;

    // Follows the finger down, and barely gives when pulled up.
    sheet.style.translate = `0 ${offset > 0 ? offset : offset * 0.05}px`;
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const sheet = sheetRef.current;
    if (!drag || !sheet || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    if (!drag.active) return;

    // Hands the position back to CSS, which springs it home or slides it out.
    delete sheet.dataset.dragging;
    sheet.style.translate = "";

    const offset = event.clientY - drag.startY;
    // A finger that stopped before lifting isn't a flick.
    const velocity = event.timeStamp - drag.lastTime < 100 ? drag.velocity : 0;
    if (event.type === "pointerup" && (offset > CLOSE_DISTANCE_PX || velocity > CLOSE_VELOCITY_PX_PER_MS)) {
      onClose();
    }
  }

  // A drag that ends over a link shouldn't also follow it.
  function blockClickAfterDrag(event: MouseEvent) {
    if (draggedRef.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="more-title"
      data-state={open ? "open" : "closed"}
      onCancel={handleCancel}
      onClose={onClose}
      onClick={handleClick}
      className="inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-transparent p-0 text-fg open:flex open:flex-col open:justify-end lg:hidden"
    >
      {/* On short screens (a phone on its side) the list scrolls, so only the header drags. */}
      <div
        ref={sheetRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClickCapture={blockClickAfterDrag}
        className="sheet mx-auto max-h-[calc(100dvh-env(safe-area-inset-top)-0.5rem)] w-full max-w-lg touch-none overflow-y-auto overscroll-contain rounded-t-[28px] bg-surface-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-12px_48px_rgb(0_0_0/0.35)] ring-1 ring-line [@media(max-height:36rem)]:touch-pan-y"
      >
        <div className="touch-none">
          <div aria-hidden className="flex justify-center pt-2.5 pb-1">
            <span className="h-1.5 w-10 rounded-full bg-fg/20" />
          </div>

          <div className="flex items-center justify-between pr-3 pl-5">
            <h2 id="more-title" className="font-display text-h2">
              More
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="pressable grid size-11 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"
            >
              <X aria-hidden className="size-6" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </div>

        <ul className="mt-2 px-3">
          {moreItems.map(({ icon: Icon, ...item }) => {
            const active = isActive(pathname, item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className="pressable flex items-center gap-4 rounded-tile px-2 py-2.5 hover:bg-surface"
                >
                  <span
                    className={`grid size-12 shrink-0 place-items-center rounded-[14px] ${
                      active ? "bg-accent text-on-accent" : "bg-bg text-fg ring-1 ring-line ring-inset"
                    }`}
                  >
                    <Icon aria-hidden className="size-[22px]" strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{item.label}</span>
                    <span className="block text-small text-muted">{item.description}</span>
                  </span>
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mx-5 mt-3 flex items-center justify-between border-t border-line pt-3">
          <p className="text-small text-muted">Follow along</p>
          <ul className="-mr-2 flex">
            {site.socials.map((social) => (
              <li key={social.kind}>
                <a
                  href={social.href}
                  className="pressable grid size-11 place-items-center rounded-full text-fg hover:bg-surface"
                >
                  <SocialIcon kind={social.kind} className="size-[22px]" />
                  <span className="sr-only">{social.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </dialog>
  );
}

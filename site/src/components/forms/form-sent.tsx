"use client";

import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { type CSSProperties, useEffect, useRef } from "react";
import { Button, ButtonLink } from "@/components/button";
import { sent as copy } from "@/content/forms";
import type { MessageKind } from "@/lib/forms/schemas";

// The confetti: dots that fly out from the check at even angles.
const DOTS = Array.from({ length: 10 }, (_, index) => {
  const angle = (index / 10) * 2 * Math.PI - Math.PI / 2;
  const distance = index % 2 === 0 ? 64 : 48;
  return {
    "--burst-x": `${Math.round(Math.cos(angle) * distance)}px`,
    "--burst-y": `${Math.round(Math.sin(angle) * distance)}px`,
  } as CSSProperties;
});

export type SentProps = {
  kind: MessageKind;
  firstName: string;
  /** The thank-you's heading level, to fit the page around the form. */
  as?: "h2" | "h3";
  /** A button to fill in the form again, like "Send another message". */
  againLabel?: string;
  onAgain: () => void;
  /** Where to go next. */
  next?: { href: string; label: string };
};

/**
 * The thank-you that replaces a form once it's sent: a check that pops in
 * with a burst of dots, then who hears about it next. It takes the focus,
 * so a screen reader reads it out.
 */
export function FormSent({ kind, firstName, as: Heading = "h2", againLabel, onAgain, next }: SentProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const heading = headingRef.current;
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: "center", behavior: "instant" });
  }, []);

  return (
    <div className="flex flex-col items-center py-4 text-center sm:py-8">
      <div className="relative grid size-20 place-items-center">
        {DOTS.map((style, index) => (
          <span
            key={index}
            aria-hidden
            style={style}
            className={`absolute top-1/2 left-1/2 -mt-1 -ml-1 size-2 animate-burst rounded-full opacity-0 [animation-delay:150ms] motion-reduce:hidden ${
              index % 3 === 0 ? "bg-fg" : "bg-accent"
            }`}
          />
        ))}
        <span className="grid size-20 animate-pop place-items-center rounded-full bg-accent text-on-accent motion-reduce:animate-none">
          <Check aria-hidden className="size-10" strokeWidth={3} />
        </span>
      </div>

      <Heading ref={headingRef} tabIndex={-1} className="mt-6 font-display text-h2 text-balance outline-hidden">
        {copy[kind].title(firstName)}
      </Heading>
      <p className="mt-2 max-w-sm text-pretty text-muted">{copy[kind].body}</p>

      {(againLabel || next) && (
        <div className="mt-7 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          {next && (
            <ButtonLink href={next.href} variant="secondary" className="w-full sm:w-auto">
              {next.label}
              <ArrowRight aria-hidden />
            </ButtonLink>
          )}
          {againLabel && (
            <Button variant="ghost" onClick={onAgain} className="w-full sm:w-auto">
              <RotateCcw aria-hidden />
              {againLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

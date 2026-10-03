"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The title of a heads-up that's come down, or an event that's cancelled
 * or over. Ending or cancelling one swaps the page out from under the
 * button that did it, so focus picks up here instead of falling back to
 * the top of the page.
 */
export function PastHeading({ children }: { children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (document.activeElement === document.body) heading.current?.focus();
  }, []);

  return (
    <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-pretty outline-none">
      {children}
    </h1>
  );
}

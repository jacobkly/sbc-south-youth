"use client";

/**
 * A script that runs while the HTML parses, before the first paint.
 * Browsers never run scripts React adds later, so after a client-side
 * navigation it's inert text, and the caller's client component redoes
 * the work. Switching the type on the client keeps React from warning.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

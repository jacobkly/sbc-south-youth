import type { ComponentProps } from "react";
import { InlineScript } from "@/components/inline-script";

/**
 * Fades an element up into place the first time it scrolls into view.
 * Put `RevealScript` after the last one on the page. Without it, after a
 * client-side navigation, or with reduced motion, everything just shows
 * (see `[data-reveal]` in globals.css).
 */
export function Reveal({ className = "", children, ...rest }: ComponentProps<"div">) {
  return (
    // The script changes `data-reveal` before React hydrates.
    <div data-reveal="" suppressHydrationWarning className={className} {...rest}>
      {children}
    </div>
  );
}

/**
 * Hides every reveal before the first paint, then shows each one as it
 * scrolls in, once. It runs as an inline script, so it can't use imports.
 */
function revealOnScroll(): void {
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.setAttribute("data-reveal", "shown");
        observer.unobserve(entry.target);
      });
    },
    // Until it's a little way in, so the fade isn't spent at the very edge.
    { rootMargin: "0px 0px -8% 0px" },
  );
  document.querySelectorAll('[data-reveal=""]').forEach((element) => {
    element.setAttribute("data-reveal", "armed");
    observer.observe(element);
  });
}

/** Arms the reveals above it. It only runs on a full page load. */
export function RevealScript() {
  return <InlineScript html={`(${revealOnScroll.toString()})()`} />;
}

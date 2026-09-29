import type { Leader } from "@/lib/content/types";
import { initials } from "@/lib/initials";
import { Photo } from "./photo";

/** A leader's round portrait, or their initials on generated art. Decorative: their name sits beside it. */
export function Avatar({ leader, className = "size-16" }: { leader: Leader; className?: string }) {
  return (
    <span aria-hidden className={`@container relative isolate grid shrink-0 place-items-center overflow-hidden rounded-full ${className}`}>
      <Photo photo={leader.photo ? { ...leader.photo, alt: "" } : undefined} seed={leader.slug} sizes="96px" className="-z-10" />
      {!leader.photo && (
        // Sized to the circle, so the initials fit at any size.
        <span className="font-display text-[32cqw] font-extrabold tracking-[-0.02em] text-white">{initials(leader.name)}</span>
      )}
    </span>
  );
}

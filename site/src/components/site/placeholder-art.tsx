import type { CSSProperties } from "react";
import { placeholderArt } from "@/lib/placeholder-art";

/**
 * Generated poster art for anything without a photo: two glows, grain, a
 * thin ring, and an optional big word. It's decorative, so screen readers
 * skip it. It fills its parent, and it's dark in both themes, like a photo.
 */
export function PlaceholderArt({ seed, label, className = "" }: { seed: string; label?: string; className?: string }) {
  const art = placeholderArt(seed);

  return (
    <div
      aria-hidden
      className={`@container absolute inset-0 overflow-hidden ${className}`}
      style={{ backgroundColor: art.base, backgroundImage: art.backgroundImage }}
    >
      <div
        className="absolute aspect-square -translate-1/2 rounded-full ring-1 ring-white/20"
        style={{ left: `${art.ring.x}%`, top: `${art.ring.y}%`, width: `${art.ring.size}%` }}
      />
      <div className="grain absolute inset-0 opacity-25 mix-blend-overlay" />
      {label && (
        // Sized so the word spans the frame whatever its length, and sits on the bottom edge.
        <span
          className="absolute bottom-0 left-[4cqw] translate-y-[0.13em] font-display text-[min(26cqw,calc(150cqw/var(--chars)))] leading-[0.8] font-extrabold tracking-[-0.04em] whitespace-nowrap text-white/90 uppercase"
          style={{ "--chars": label.length } as CSSProperties}
        >
          {label}
        </span>
      )}
    </div>
  );
}

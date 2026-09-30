import type { ReactNode } from "react";

const tones = {
  accent: "bg-accent text-on-accent",
  solid: "bg-fg text-bg",
  outline: "text-fg ring-1 ring-line-strong ring-inset",
  pending: "border border-dashed border-line-strong text-muted",
  // Over a photo, where a see-through tag could land on a bright spot.
  glass: "bg-black/45 text-white ring-1 ring-white/25 ring-inset backdrop-blur-md",
} as const;

export type TagTone = keyof typeof tones;

/** A small sticker-style label. */
export function Tag({ tone = "outline", children }: { tone?: TagTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-2.5 font-display text-[0.6875rem] font-bold tracking-[0.06em] uppercase ${tones[tone]}`}
    >
      {children}
    </span>
  );
}


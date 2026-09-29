import type { ReactNode } from "react";
import type { Audience } from "@/lib/content/types";

export const audienceLabels: Record<Audience, string> = {
  all: "Everyone",
  hs: "High school",
  college: "College",
};

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

const audienceTones: Record<Audience, TagTone> = { hs: "accent", college: "solid", all: "outline" };

/** Who an event or announcement is for. */
export function AudienceTag({ audience }: { audience: Audience }) {
  return <Tag tone={audienceTones[audience]}>{audienceLabels[audience]}</Tag>;
}

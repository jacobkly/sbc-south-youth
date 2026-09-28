import type { ReactNode } from "react";
import type { SocialKind } from "@/content/site";

// lucide-react has no brand icons, so these are drawn in its style:
// a 24 px grid, 2 px round strokes, and no fill.
const paths: Record<SocialKind, ReactNode> = {
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.5 6.5h.01" />
    </>
  ),
  tiktok: (
    <>
      <path d="M14 3v11.5a4.5 4.5 0 1 1-4.5-4.5" />
      <path d="M14 3a5 5 0 0 0 5 5" />
    </>
  ),
  youtube: (
    <>
      <path d="M2.5 17a24 24 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24 24 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </>
  ),
};

export function SocialIcon({ kind, className = "size-5" }: { kind: SocialKind; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths[kind]}
    </svg>
  );
}

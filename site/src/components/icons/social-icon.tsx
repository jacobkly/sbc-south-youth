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

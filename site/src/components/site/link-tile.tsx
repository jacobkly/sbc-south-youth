import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** A big tappable card that leads to another page. The accent tone is for the one tile that matters most. */
export function LinkTile({
  href,
  eyebrow,
  title,
  children,
  tone = "surface",
}: {
  href: string;
  eyebrow: string;
  title: string;
  children?: ReactNode;
  tone?: "surface" | "accent";
}) {
  const tones = {
    surface: "bg-surface ring-1 ring-line ring-inset hover:bg-surface-2",
    accent: "bg-accent text-on-accent hover:brightness-105",
  };

  return (
    <Link
      href={href}
      className={`group pressable flex min-h-44 flex-col justify-between gap-6 rounded-card p-5 sm:p-6 ${tones[tone]}`}
    >
      <div>
        <p className={`text-eyebrow uppercase ${tone === "accent" ? "" : "text-accent-ink"}`}>{eyebrow}</p>
        <p className="mt-2 max-w-sm font-display text-h2 text-balance">{title}</p>
        {children && <p className={`mt-2 max-w-sm text-pretty ${tone === "accent" ? "" : "text-muted"}`}>{children}</p>}
      </div>
      <span
        aria-hidden
        className={`grid size-11 place-items-center self-end rounded-full transition-transform duration-200 ease-out-soft group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none ${
          tone === "accent" ? "bg-on-accent text-accent" : "bg-accent text-on-accent"
        }`}
      >
        <ArrowUpRight className="size-5" />
      </span>
    </Link>
  );
}

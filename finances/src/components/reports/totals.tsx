import type { ReactNode } from "react";
import { cn } from "cn";
import { periodLabel, type Period } from "@/lib/dates";
import { formatCents } from "@/lib/money";

/** The period as a sentence ends it: "in Q3 2026", or a custom range on its own. */
export function within(period: Period): string {
  const label = periodLabel(period);
  return period.kind === "custom" ? label : `in ${label}`;
}

export function Heading({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <div>
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </div>
  );
}

/**
 * Amounts in one bordered box: a row each on a phone, and side by side when
 * the `@container` around it has room.
 */
export function Cells({ children }: { children: ReactNode }) {
  return <dl className="grid divide-y rounded-lg border @lg:grid-cols-3 @lg:divide-x @lg:divide-y-0">{children}</dl>;
}

const CELL = "flex items-start justify-between gap-3 px-4 py-3 @lg:flex-col @lg:justify-start @lg:gap-1";

/** One amount, with what it's made of and how it changed. */
export function Cell({
  label,
  swatch,
  cents,
  detail,
  change,
  size = "default",
}: {
  label: string;
  /** A type's color, so the cell matches its charts. */
  swatch?: string;
  cents: number;
  detail?: string;
  change?: ReactNode;
  /** "lg" is for the amounts a page opens with. */
  size?: "default" | "lg";
}) {
  return (
    <div className={CELL}>
      <dt className={cn("flex items-center gap-2 text-sm", size === "lg" && "py-1 font-medium @lg:py-0")}>
        {swatch && <span aria-hidden className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: swatch }} />}
        {label}
      </dt>
      <dd className="min-w-0 text-right tabular-nums @lg:text-left">
        <span
          className={cn(
            "block font-semibold",
            size === "lg" && "text-xl tracking-tight @lg:text-lg @2xl:text-2xl",
          )}
        >
          {formatCents(cents)}
        </span>
        {detail && <span className="block text-sm text-muted-foreground">{detail}</span>}
        {change}
      </dd>
    </div>
  );
}

/** A cell with nothing to show, saying why. */
export function EmptyCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={CELL}>
      <dt className="text-sm">{label}</dt>
      <dd className="text-right text-sm text-muted-foreground @lg:text-left">{children}</dd>
    </div>
  );
}

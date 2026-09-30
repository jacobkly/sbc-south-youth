import type { ComponentProps } from "react";
import { Reveal } from "./reveal";

/**
 * How much of the grid a tile takes, by how much it matters. The grid is
 * 2 columns on phones and tablets, 4 on desktop, and 5 on wide screens.
 *
 * - `spotlight`: the widest and tallest. Full width on phones and
 *   tablets, 3 columns by 2 rows on desktop, and 2 by 2 on wide screens.
 * - `feature`: full width on phones, then 1 column by 2 rows.
 * - `small`: 1 cell, so two share a row on phones.
 */
export type TileSize = "spotlight" | "feature" | "small";

const sizes: Record<TileSize, string> = {
  spotlight: "col-span-2 lg:col-span-3 lg:row-span-2 2xl:col-span-2",
  feature: "col-span-2 md:col-span-1 md:row-span-2",
  small: "col-span-1",
};

/** A grid cell that fades in as it scrolls into view. Its card fills it. */
export function BentoTile({ size, className = "", ...rest }: { size: TileSize } & ComponentProps<"div">) {
  return <Reveal className={`min-w-0 ${sizes[size]} ${className}`} {...rest} />;
}

export type TileTone = "photo" | "accent" | "surface";

const tones: Record<TileTone, string> = {
  // Add `data-theme="dark"` too, so text on the photo stays light.
  photo: "bg-bg text-fg",
  accent: "bg-accent text-on-accent",
  surface: "bg-surface ring-1 ring-line ring-inset",
};

/** The card inside a tile. */
export function tileClasses(tone: TileTone, className = ""): string {
  return `relative isolate flex h-full flex-col overflow-hidden rounded-card ${tones[tone]} ${className}`;
}

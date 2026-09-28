/**
 * Poster-style art for anything without a photo, picked from a seed like
 * an event's slug. The same seed always draws the same art, so a card
 * doesn't change between renders or between the server and the browser.
 */

export type Palette = { name: string; base: string; colors: [string, string] };

// Night colors that sit well with the near-black page and the accent.
export const PALETTES: Palette[] = [
  { name: "lime", base: "#0b0b0f", colors: ["#c6ff3d", "#17a589"] },
  { name: "violet", base: "#0d0a18", colors: ["#7c5cff", "#ff4fd8"] },
  { name: "flare", base: "#120a08", colors: ["#ff5a1f", "#ffb800"] },
  { name: "ocean", base: "#070d18", colors: ["#2f6bff", "#22d3ee"] },
  { name: "rose", base: "#14080d", colors: ["#ff3d6e", "#8b5cf6"] },
];

export type Art = {
  palette: string;
  base: string;
  backgroundImage: string;
  /** A thin circle: center and size in percent of the frame's width. */
  ring: { x: number; y: number; size: number };
};

export function placeholderArt(seed: string): Art {
  const random = mulberry32(fnv1a(seed));
  const between = (min: number, max: number) => Math.round(min + random() * (max - min));

  const palette = PALETTES[Math.floor(random() * PALETTES.length)];
  const [first, second] = random() < 0.5 ? palette.colors : [palette.colors[1], palette.colors[0]];

  // Two glows in opposite corners, so the light falls across the frame.
  const glowX = between(0, 40);
  const glowY = between(0, 45);
  const backgroundImage = [
    `radial-gradient(70% 80% at ${glowX}% ${glowY}%, ${first} 0%, transparent 65%)`,
    `radial-gradient(60% 75% at ${between(65, 100)}% ${between(55, 100)}%, ${second} 0%, transparent 70%)`,
    `linear-gradient(${between(150, 210)}deg, transparent 30%, ${palette.base} 100%)`,
  ].join(", ");

  return {
    palette: palette.name,
    base: palette.base,
    backgroundImage,
    ring: { x: between(20, 80), y: between(20, 80), size: between(40, 90) },
  };
}

/** A 32-bit FNV-1a hash of a string. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A small seeded random number generator, returning numbers in [0, 1). */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

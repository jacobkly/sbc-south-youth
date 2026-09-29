import type { Audience } from "./content/types";

/**
 * The audience filter on This Week. It has no other imports, so the
 * client chips can use it without pulling in the date helpers.
 */

/** An audience someone can filter by. Items for `all` show under both. */
export type AudienceFilter = Exclude<Audience, "all">;

export const audienceFilters: AudienceFilter[] = ["hs", "college"];

const filterKeys = ["all", ...audienceFilters] as const;

/**
 * The filters something shows under, as a space-separated list for a
 * `data-show` attribute: "all" means no filter. For a group of items,
 * pass every item's audience.
 */
export function showKeys(audiences: Audience | Audience[]): string {
  const keys = new Set<string>();
  for (const audience of [audiences].flat()) {
    keys.add("all");
    if (audience === "all") audienceFilters.forEach((filter) => keys.add(filter));
    else keys.add(audience);
  }
  return filterKeys.filter((key) => keys.has(key)).join(" ");
}

/** Items for that audience plus everyone's, or everything without a filter. */
export function forAudience<T extends { audience: Audience }>(items: T[], audience: AudienceFilter | null): T[] {
  if (!audience) return items;
  return items.filter((item) => item.audience === audience || item.audience === "all");
}

/** The `?for=` filter, or null when it's missing or unknown. */
export function parseAudience(value: string | string[] | undefined): AudienceFilter | null {
  const first = Array.isArray(value) ? value[0] : value;
  return audienceFilters.find((audience) => audience === first) ?? null;
}

/**
 * The places on the public site a photo can go. A placed photo's row keeps
 * its spot's code name, the portal lists the spots by page, and each page
 * shows whatever photo holds its spot. Event covers are set by event
 * instead. Renaming a spot drops its photo off the site, so names stay.
 */

export type PhotoSpotInfo = {
  /** The code name in site.photos.spot. */
  spot: string;
  /** The page the portal lists it under, as the site names it. */
  page: string;
  /** What it is on that page. */
  label: string;
  /** For the badge on its photo in the library. */
  short: string;
};

// In the order the site's nav goes, so each page's spots stay together.
export const PHOTO_SPOTS = [
  { spot: "home-hero", page: "Home", label: "Top of the page", short: "Home" },
  { spot: "bring-a-friend", page: "This Week", label: "Bring a friend, also on Home", short: "Bring a friend" },
  { spot: "youth-cafe", page: "This Week", label: "The Youth Cafe", short: "Youth Cafe" },
  { spot: "weekly-youth", page: "Plan a Visit", label: "Friday youth", short: "Friday youth" },
  { spot: "entrance", page: "Plan a Visit", label: "The entrance, also on Parents", short: "Entrance" },
  { spot: "parents-photos", page: "Parents & Safety", label: "Photos and your student", short: "Parents" },
  { spot: "give-food", page: "Give", label: "Friday night food", short: "Give" },
  { spot: "give-birthdays", page: "Give", label: "Birthday treats", short: "Give" },
  { spot: "give-volleyball", page: "Give", label: "Volleyball days", short: "Give" },
  { spot: "give-band", page: "Give", label: "Wide photo, big screens only", short: "Give" },
] as const satisfies readonly PhotoSpotInfo[];

export type PhotoSpot = (typeof PHOTO_SPOTS)[number]["spot"];

const SPOTS = new Map<string, PhotoSpotInfo>(PHOTO_SPOTS.map((info) => [info.spot, info]));

export function isPhotoSpot(value: unknown): value is PhotoSpot {
  return typeof value === "string" && SPOTS.has(value);
}

export function spotInfo(spot: PhotoSpot): PhotoSpotInfo {
  return SPOTS.get(spot)!;
}

/** The spots grouped by page, in the site's order. */
export function spotsByPage(): [page: string, spots: PhotoSpotInfo[]][] {
  const pages = new Map<string, PhotoSpotInfo[]>();
  for (const info of PHOTO_SPOTS) pages.set(info.page, [...(pages.get(info.page) ?? []), info]);
  return [...pages];
}

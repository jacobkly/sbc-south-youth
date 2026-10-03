import { photos } from "./photos";
import type { Photo } from "@/lib/content/types";

/**
 * Placeholder photos for the local seed's events, by event id, until
 * photos come from the portal. Events and heads-ups themselves come from
 * the database (`supabase/seed.sql` locally). These ids only exist in the
 * seed, so no real event ever picks one up.
 */
export const seedEventPhotos: Readonly<Record<string, Photo>> = {
  "00000000-0000-4000-8000-5eed0000e001": photos.crowdSilhouette,
  "00000000-0000-4000-8000-5eed0000e002": photos.volleyball,
  "00000000-0000-4000-8000-5eed0000e003": photos.cabin,
  "00000000-0000-4000-8000-5eed0000e004": photos.stageLights,
  "00000000-0000-4000-8000-5eed0000e006": photos.campfireChairs,
};

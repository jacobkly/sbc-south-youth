/**
 * Placeholder photos, hotlinked from Unsplash until the media team's
 * photos arrive. None of these are of our students. Every one gets
 * replaced before launch.
 */

import type { Photo } from "@/lib/content/types";

// Matches the one query next.config.ts allows for Unsplash images.
function unsplash(id: string, alt: string): Photo {
  return { src: `https://images.unsplash.com/${id}?w=1600&q=80&auto=format`, alt, placeholder: true };
}

export const photos = {
  worshipCrowd: unsplash("photo-1470229722913-7c0e2dbbafd3", "Stage lights over a crowd with hands raised"),
  handsRaised: unsplash("photo-1438232992991-995b7058bbb3", "A hand raised during worship"),
  stageLights: unsplash("photo-1507874457470-272b3c8d8ee2", "A band playing under stage lights"),
  crowdSilhouette: unsplash("photo-1475527588268-e6a157656e35", "Silhouettes of a crowd under bright lights"),
  friendsLaughing: unsplash("photo-1582298538104-fe2e74c27f59", "Friends laughing and high-fiving over coffee"),
  friendsTable: unsplash("photo-1681641095463-b4d3693a0ee3", "Friends talking around a table"),
  friendsOutside: unsplash("photo-1491438590914-bc09fcaaf77a", "Friends laughing and talking outside"),
  campfire: unsplash("photo-1486679679458-629f321a617c", "Friends gathered around a campfire at night"),
  campfireChairs: unsplash("photo-1609788063095-d71bf3c1f01f", "Camp chairs around a bonfire at night"),
  bibleStudy: unsplash("photo-1716666178997-6e4a056f07d1", "A group at a table with open books"),
  bibleStudyOutside: unsplash("photo-1663162550932-f67b561e656f", "A group sitting on the grass reading together"),
  pizza: unsplash("photo-1581542241119-a3094c6702a2", "Friends sharing pepperoni pizza"),
  pizzaTable: unsplash("photo-1606066889831-35faf6fa6ff6", "A table covered in pizza and snacks"),
  gym: unsplash("photo-1559369064-c4d65141e408", "An indoor basketball court"),
  cabin: unsplash("photo-1475087542963-13ab5e611954", "A wooden cabin in the mountains"),
  entrance: unsplash("photo-1759300631833-d6d645b494e0", "A hallway leading to lit glass doors"),
  mixer: unsplash("photo-1504904126298-3fde501c9b31", "Hands on a sound board"),
  camera: unsplash("photo-1554048612-b6a482bc67e5", "Someone taking a photo with a camera"),
  guitar: unsplash("photo-1510915361894-db8b60106cb1", "Someone playing an acoustic guitar"),
} satisfies Record<string, Photo>;

export type PhotoName = keyof typeof photos;

import { photos } from "./photos";
import type { WeeklyGathering } from "@/lib/content/types";

/**
 * The nights that repeat every week. Pages read these through
 * `getSchedule()`, never from here. A cancelled night is posted as an
 * announcement instead of changing this file.
 *
 * TODO(leadership): real days, times, rooms, and descriptions.
 */
export const gatherings: WeeklyGathering[] = [
  {
    slug: "weekly-hs",
    title: "High School Youth Night",
    audience: "hs",
    weekday: 3,
    startTime: "19:00",
    endTime: "21:00",
    locationName: "Youth Room",
    description: "Games, food, worship, a message, and small groups by grade.",
    photo: photos.worshipCrowd,
  },
  {
    slug: "weekly-college",
    title: "College Night",
    audience: "college",
    weekday: 4,
    startTime: "19:30",
    endTime: "21:30",
    locationName: "The Loft",
    description: "Dinner together, then worship and a study that goes deeper.",
    photo: photos.friendsTable,
  },
];

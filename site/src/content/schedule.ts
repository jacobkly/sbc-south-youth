import { photos } from "./photos";
import type { WeeklyGathering } from "@/lib/content/types";

/**
 * The nights that repeat every week. Pages read these through
 * `getSchedule()`, never from here. A cancelled night is posted as an
 * announcement instead of changing this file.
 */
export const gatherings: WeeklyGathering[] = [
  {
    slug: "weekly-youth",
    // It has no name. Everyone just calls it "youth".
    title: "Youth",
    weekday: 5,
    startTime: "19:30",
    endTime: "21:00",
    description: "Worship and a message, then food, the cafe, and hanging out until 9:30 or 10.",
    photo: photos.worshipCrowd,
  },
];
